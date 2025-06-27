/**
 * Extension Error Suppressor
 * 
 * This utility helps suppress console errors and warnings that are commonly
 * caused by browser extensions when working with iframes and automated browsing.
 * These errors don't affect functionality but can clutter the console.
 */

export interface ExtensionError {
  type: 'frame' | 'resource' | 'webgl' | 'script';
  message: string;
  source?: string;
}

class ExtensionSuppressor {
  private suppressedErrors: ExtensionError[] = [];
  private isActive: boolean = false;

  // Common patterns that indicate extension-related errors
  private readonly errorPatterns = [
    /FrameDoesNotExistError/i,
    /ERR_FILE_NOT_FOUND.*extensionState\.js/i,
    /ERR_FILE_NOT_FOUND.*heuristicsRedefinitions\.js/i,
    /ERR_FILE_NOT_FOUND.*utils\.js/i,
    /THREE\.WebGLRenderer.*Context Lost/i,
    /Script error for: chrome-extension:\/\//i,
    /Script error for: moz-extension:\/\//i,
    /Script error for: safari-extension:\/\//i,
    /Non-Error promise rejection captured.*Frame/i,
    /DelayedMessageSender/i,
    /chrome\.runtime\.sendMessage/i,
    /browser\.runtime\.sendMessage/i
  ];

  private readonly resourcePatterns = [
    /vite\.svg.*404/i,
    /favicon\.ico.*404/i,
    /chrome-extension:\/\/.*\/.*\.js/i,
    /moz-extension:\/\/.*\/.*\.js/i
  ];

  activate(): void {
    if (this.isActive) return;
    
    this.isActive = true;
    this.suppressConsoleErrors();
    this.suppressWindowErrors();
    this.suppressResourceErrors();
    
    console.debug('Extension error suppressor activated');
  }

  deactivate(): void {
    if (!this.isActive) return;
    
    this.isActive = false;
    // Note: Cannot easily restore original console methods without storing references
    console.debug('Extension error suppressor deactivated');
  }

  private suppressConsoleErrors(): void {
    const originalError = console.error;
    const originalWarn = console.warn;

    console.error = (...args: any[]) => {
      const message = args.join(' ');
      
      if (this.isExtensionError(message)) {
        this.logSuppressedError('console', message);
        return;
      }
      
      originalError.apply(console, args);
    };

    console.warn = (...args: any[]) => {
      const message = args.join(' ');
      
      if (this.isExtensionError(message)) {
        this.logSuppressedError('console', message);
        return;
      }
      
      originalWarn.apply(console, args);
    };
  }

  private suppressWindowErrors(): void {
    window.addEventListener('error', (event) => {
      const message = event.error?.message || event.message || '';
      const filename = event.filename || '';
      
      if (this.isExtensionError(message) || this.isExtensionScript(filename)) {
        this.logSuppressedError('window', message, filename);
        event.preventDefault();
        return false;
      }
    });

    window.addEventListener('unhandledrejection', (event) => {
      const message = event.reason?.message || event.reason?.toString() || '';
      
      if (this.isExtensionError(message)) {
        this.logSuppressedError('promise', message);
        event.preventDefault();
        return false;
      }
    });
  }

  private suppressResourceErrors(): void {
    // Override fetch to suppress extension resource errors
    const originalFetch = window.fetch;
    
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      try {
        return await originalFetch.apply(window, args);
      } catch (error: any) {
        const url = args[0]?.toString() || '';
        
        if (this.isExtensionResource(url) || this.isExtensionError(error.message)) {
          this.logSuppressedError('fetch', error.message, url);
          // Return a fake successful response for extension resources
          return new Response('', { status: 204, statusText: 'No Content' });
        }
        
        throw error;
      }
    };
  }

  private isExtensionError(message: string): boolean {
    return this.errorPatterns.some(pattern => pattern.test(message));
  }

  private isExtensionScript(filename: string): boolean {
    return filename.includes('chrome-extension://') || 
           filename.includes('moz-extension://') ||
           filename.includes('safari-extension://') ||
           filename.includes('extensionState.js') ||
           filename.includes('heuristicsRedefinitions.js') ||
           filename.includes('utils.js');
  }

  private isExtensionResource(url: string): boolean {
    return this.resourcePatterns.some(pattern => pattern.test(url));
  }

  private logSuppressedError(type: string, message: string, source?: string): void {
    const error: ExtensionError = {
      type: this.categorizeError(message),
      message,
      source
    };
    
    this.suppressedErrors.push(error);
    
    // Log to debug console for developers
    console.debug(`[ExtensionSuppressor] Suppressed ${type} error:`, error);
    
    // Keep only the last 50 suppressed errors to prevent memory leaks
    if (this.suppressedErrors.length > 50) {
      this.suppressedErrors = this.suppressedErrors.slice(-50);
    }
  }

  private categorizeError(message: string): ExtensionError['type'] {
    if (message.includes('Frame') || message.includes('DelayedMessageSender')) {
      return 'frame';
    }
    if (message.includes('ERR_FILE_NOT_FOUND') || message.includes('404')) {
      return 'resource';
    }
    if (message.includes('WebGL') || message.includes('Context Lost')) {
      return 'webgl';
    }
    return 'script';
  }

  getSuppressedErrors(): ExtensionError[] {
    return [...this.suppressedErrors];
  }

  getSuppressedErrorCount(): number {
    return this.suppressedErrors.length;
  }

  clearSuppressedErrors(): void {
    this.suppressedErrors = [];
  }

  getErrorSummary(): Record<ExtensionError['type'], number> {
    return this.suppressedErrors.reduce((acc, error) => {
      acc[error.type] = (acc[error.type] || 0) + 1;
      return acc;
    }, {} as Record<ExtensionError['type'], number>);
  }
}

// Export singleton instance
export const extensionSuppressor = new ExtensionSuppressor();

// Auto-activate in production or when LinkedIn automation is detected
if (typeof window !== 'undefined') {
  // Check if we're in a browser environment
  const shouldAutoActivate = 
    import.meta.env.PROD ||
    window.location.pathname.includes('linkedin') ||
    document.title.includes('LinkedIn') ||
    // Check for automation-related elements
    !!document.querySelector('[data-automation]') ||
    !!document.querySelector('[id*="automation"]');

  if (shouldAutoActivate) {
    extensionSuppressor.activate();
  }
}

export default extensionSuppressor; 