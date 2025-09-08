import React, { useState, useEffect, useRef, useCallback, forwardRef } from 'react';
import { Editor, type EditorRef, type MentionItem } from 'textforge';
import { AIEditButton } from './AIEditButton';
import { AIEditDialog } from './AIEditDialog';
import { useAIEdit } from '../../hooks/useAIEdit';
import { useSettings } from '../../hooks/useSettings';
import { parseMarkdownToHTML } from '../../utils/markdownParser';

interface AIEnabledEditorProps {
	content: string;
	editable: boolean;
	onChange?: (html: string) => void;
	onImageUpload?: (file: File) => Promise<string>;
	onAutoSave?: (html: string) => Promise<void>;
	mentions?: MentionItem[];
}

export const AIEnabledEditor = forwardRef<EditorRef, AIEnabledEditorProps>(
	function AIEnabledEditor(props, ref) {
		const { settings } = useSettings();
		const { editText } = useAIEdit();
		
		const [selection, setSelection] = useState<{
			text: string;
			x: number;
			y: number;
		} | null>(null);
		const [dialogOpen, setDialogOpen] = useState(false);
		const [savedSelection, setSavedSelection] = useState<{
			text: string;
			range: Range | null;
		} | null>(null);
		const editorRef = useRef<EditorRef>(null);
		const selectionTimeoutRef = useRef<NodeJS.Timeout>();

		// Forward ref to parent component
		React.useImperativeHandle(ref, () => editorRef.current!, []);

		const handleSelection = useCallback(() => {
			// Clear any existing timeout
			if (selectionTimeoutRef.current) {
				clearTimeout(selectionTimeoutRef.current);
			}

			// Wait a bit for selection to stabilize
			selectionTimeoutRef.current = setTimeout(() => {
				const sel = window.getSelection();
				
				if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
					const selectedText = sel.toString().trim();
					if (selectedText.length > 0) {
						const range = sel.getRangeAt(0);
						const rect = range.getBoundingClientRect();
						
						// Check if selection is within the editor
						let editorEl = editorRef.current?.getElement?.();
						
						// Fallback: try to find editor by common TextForge classes
						if (!editorEl) {
							editorEl = document.querySelector('.ProseMirror') || 
									  document.querySelector('[contenteditable="true"]') ||
									  document.querySelector('.editor-wrap > div');
						}
						
						if (editorEl && editorEl.contains(range.commonAncestorContainer)) {
							const centerX = rect.left + (rect.width / 2);
							const newSelection = {
								text: selectedText,
								x: centerX,
								y: rect.top + window.scrollY,
							};
							setSelection(newSelection);
						}
					}
				} else {
					setSelection(null);
				}
			}, 100);
		}, []);

		const handleMouseUp = useCallback(() => {
			// Only show AI button if AI is enabled and we're authenticated
			if (settings.ai_enabled && props.editable) {
				handleSelection();
			}
		}, [settings.ai_enabled, props.editable, handleSelection]);

		const handleKeyUp = useCallback((e: KeyboardEvent) => {
			// Only show AI button if AI is enabled and we're authenticated
			if (settings.ai_enabled && props.editable) {
				// Don't trigger on certain keys that don't change selection meaningfully
				if (['Shift', 'Control', 'Meta', 'Alt'].includes(e.key)) return;
				handleSelection();
			}
		}, [settings.ai_enabled, props.editable, handleSelection]);

		const handleAIEdit = useCallback(() => {
			if (selection) {
				// Save the current selection and range before opening dialog
				const sel = window.getSelection();
				let range: Range | null = null;
				
				if (sel && sel.rangeCount > 0) {
					range = sel.getRangeAt(0).cloneRange(); // Clone the range to preserve it
				}
				
				setSavedSelection({
					text: selection.text,
					range: range
				});
				
				setDialogOpen(true);
			}
		}, [selection]);

		const handleApplyEdit = useCallback((editedText: string) => {
			if (!savedSelection || !editorRef.current?.editor) {
				console.warn('No saved selection or editor available');
				return;
			}

			const editor = editorRef.current.editor;
			
			// Simple approach: find the original text in the editor and replace it
			try {
				const currentContent = editor.getHTML();
				const originalText = savedSelection.text;
				
				console.log('Attempting to replace:', originalText);
				console.log('With:', editedText);
				
				// Parse markdown to HTML
				const htmlContent = parseMarkdownToHTML(editedText);
				console.log('Parsed HTML:', htmlContent);
				
				// Try to find and replace the text using editor's built-in search and replace
				const { state } = editor;
				const { doc } = state;
				
				// Search for the original text in the document
				let foundPos = null;
				doc.descendants((node, pos) => {
					if (node.isText && node.text?.includes(originalText)) {
						const textStart = node.text.indexOf(originalText);
						foundPos = {
							from: pos + textStart,
							to: pos + textStart + originalText.length
						};
						return false; // Stop searching
					}
				});
				
				if (foundPos) {
					console.log('Found text at position:', foundPos);
					
					// Replace the content
					editor
						.chain()
						.focus()
						.setTextSelection(foundPos)
						.deleteSelection()
						.insertContent(htmlContent)
						.run();
						
					console.log('Content replaced successfully');
				} else {
					console.warn('Could not find original text in document, using fallback');
					
					// Fallback: just insert at current cursor position
					editor
						.chain()
						.focus()
						.insertContent(' ' + htmlContent + ' ')
						.run();
				}
			} catch (error) {
				console.error('Error in handleApplyEdit:', error);
				
				// Final fallback - just insert the content
				try {
					editor
						.chain()
						.focus()
						.insertContent(editedText)
						.run();
				} catch (finalError) {
					console.error('All approaches failed:', finalError);
				}
			}
			
			// Clear selection and state
			setSelection(null);
			setSavedSelection(null);
		}, [savedSelection]);

		const handleDialogClose = useCallback(() => {
			setDialogOpen(false);
			setSavedSelection(null); // Clear saved selection when dialog closes
		}, []);

		const handleEditText = useCallback(async (userPrompt: string, model?: string) => {
			if (!savedSelection) throw new Error('No text selected');
			return await editText(savedSelection.text, userPrompt, model);
		}, [savedSelection, editText]);

		useEffect(() => {
			// Add global event listeners for text selection
			document.addEventListener('mouseup', handleMouseUp);
			document.addEventListener('keyup', handleKeyUp);
			
			// Also try to attach directly to the editor element
			const attachToEditor = () => {
				const editorEl = editorRef.current?.getElement?.();
				if (editorEl) {
					editorEl.addEventListener('mouseup', handleMouseUp);
					editorEl.addEventListener('keyup', handleKeyUp);
				} else {
					// Retry after a short delay
					setTimeout(attachToEditor, 500);
				}
			};
			attachToEditor();
			
			// Clear selection when clicking outside
			const handleClickOutside = (e: MouseEvent) => {
				const target = e.target as Element;
				const editorEl = editorRef.current?.getElement?.();
				if (editorEl && !editorEl.contains(target)) {
					setSelection(null);
				}
			};
			document.addEventListener('mousedown', handleClickOutside);

			return () => {
				document.removeEventListener('mouseup', handleMouseUp);
				document.removeEventListener('keyup', handleKeyUp);
				document.removeEventListener('mousedown', handleClickOutside);
				
				// Also remove from editor element if it exists
				const editorEl = editorRef.current?.getElement?.();
				if (editorEl) {
					editorEl.removeEventListener('mouseup', handleMouseUp);
					editorEl.removeEventListener('keyup', handleKeyUp);
				}
				
				if (selectionTimeoutRef.current) {
					clearTimeout(selectionTimeoutRef.current);
				}
			};
		}, [handleMouseUp, handleKeyUp]);

		// Hide AI button when dialog is open or AI is disabled
		const showAIButton = selection && !dialogOpen && settings.ai_enabled && props.editable;
		

		return (
			<>
				<Editor
					ref={editorRef}
					{...props}
				/>
				
				{showAIButton && (
					<AIEditButton
						x={selection.x}
						y={selection.y}
						onEdit={handleAIEdit}
						visible={true}
					/>
				)}

				<AIEditDialog
					isOpen={dialogOpen}
					selectedText={savedSelection?.text || ''}
					onClose={handleDialogClose}
					onApply={handleApplyEdit}
					onEdit={handleEditText}
				/>
			</>
		);
	}
);