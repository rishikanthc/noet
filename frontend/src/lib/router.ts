// Simple client-side router to eliminate page reloads
type RouterListener = (path: string) => void;

class ClientRouter {
  private listeners: Set<RouterListener> = new Set();
  
  constructor() {
    // Handle browser back/forward buttons
    window.addEventListener('popstate', () => {
      this.notifyListeners(window.location.pathname);
    });
  }
  
  // Navigate to a new route without page reload
  navigate(path: string) {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
      this.notifyListeners(path);
    }
  }
  
  // Subscribe to route changes
  subscribe(listener: RouterListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  // Get current path
  getCurrentPath(): string {
    return window.location.pathname;
  }
  
  private notifyListeners(path: string) {
    this.listeners.forEach(listener => listener(path));
  }
}

// Export singleton instance
export const router = new ClientRouter();

// Convenience function for navigation
export const navigateTo = (path: string) => {
  router.navigate(path);
};