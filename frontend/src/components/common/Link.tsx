import { ReactNode, MouseEvent, memo } from 'react';
import { navigateTo } from '../../lib/router';
import { useAuth } from '../../hooks/useAuth';
import { usePrefetch } from '../../hooks/usePrefetch';

interface LinkProps {
  href: string;
  children: ReactNode;
  className?: string;
  target?: string;
  rel?: string;
  onMouseEnter?: () => void;
}

export const Link = memo(function Link({ href, children, className, target, rel, onMouseEnter }: LinkProps) {
  const { token } = useAuth();
  const { prefetchPost, prefetchPosts, prefetchSettings } = usePrefetch(token);
  
  // Handle external links normally
  const isExternal = href.startsWith('http') || href.startsWith('mailto:') || target === '_blank';
  
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (isExternal) {
      return; // Let browser handle external links
    }
    
    e.preventDefault();
    navigateTo(href);
  };
  
  const handleMouseEnter = () => {
    onMouseEnter?.();
    
    if (!isExternal && token) {
      // Prefetch data based on route
      if (href === '/' || href === '/archive') {
        prefetchPosts();
      } else if (href === '/settings') {
        prefetchSettings();
      } else if (href.startsWith('/posts/')) {
        const postId = href.replace('/posts/', '');
        prefetchPost(postId);
      }
    }
  };
  
  return (
    <a 
      href={href}
      className={className}
      target={target}
      rel={rel}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
    >
      {children}
    </a>
  );
});