/**
 * CartRecoveryPro - Main orchestrator
 * Coordinates all recovery components
 */

class CartRecoveryPro {
  constructor() {
    this.config = window.CartRecoveryConfig || {};
    this.isInitialized = false;
    
    // Initialize components
    this.abandonmentDetector = new AbandonmentDetector(this.config);
    this.emailService = new EmailRecoveryService(this.config);
    this.popupManager = new RecoveryPopupManager(this.config);
    this.analytics = new RecoveryAnalytics(this.config);
    
    this.init();
  }

  init() {
    if (!this.config.enabled || this.isInitialized) return;

    this.initializeComponents();
    this.isInitialized = true;
    
    console.log('CartRecoveryPro initialized');
  }

  initializeComponents() {
    // Initialize popup manager
    this.popupManager.init();
    
    // Set up abandonment detection
    this.abandonmentDetector.onAbandonment((cartData) => {
      this.handleAbandonedCart(cartData);
    });
    
    this.abandonmentDetector.init();
  }

  async handleAbandonedCart(cartData) {
    console.log('Cart abandoned:', cartData);
    
    // Track abandonment
    this.analytics.trackAbandonment(cartData);
    
    // Get customer email
    const customerEmail = this.getCustomerEmail();
    
    // Show recovery popup if enabled
    if (this.config.showExitPopup) {
      this.popupManager.showRecoveryPopup(cartData, customerEmail);
      this.analytics.trackPopupShown(cartData);
    }
    
    // Start email recovery sequence if email available
    if (customerEmail && this.config.emailEnabled) {
      await this.emailService.sendRecoverySequence(cartData, customerEmail);
    }
  }

  getCustomerEmail() {
    // Try multiple sources for customer email
    return (
      localStorage.getItem('cart_recovery_email') ||
      window.ShopifyAnalytics?.meta?.page?.customerEmail ||
      this.extractEmailFromPage()
    );
  }

  extractEmailFromPage() {
    // Try to find email in form fields
    const emailInput = document.querySelector('input[type="email"]');
    return emailInput?.value || null;
  }

  // Public API methods
  captureCustomerEmail(email) {
    localStorage.setItem('cart_recovery_email', email);
    
    // Track email capture
    this.abandonmentDetector.updateCartState().then(() => {
      if (this.abandonmentDetector.currentCart) {
        this.analytics.trackEmailCaptured(email, this.abandonmentDetector.currentCart);
      }
    });
  }

  getRecoveryStats() {
    return this.analytics.getRecoveryStats();
  }

  getDetailedAnalytics() {
    return {
      stats: this.analytics.getRecoveryStats(),
      topMethods: this.analytics.getTopRecoveryMethods(),
      exportData: this.analytics.exportData()
    };
  }

  // Admin methods
  pauseRecovery() {
    this.config.enabled = false;
    this.abandonmentDetector.stop();
  }

  resumeRecovery() {
    this.config.enabled = true;
    this.abandonmentDetector.init();
  }

  testRecoveryPopup() {
    // For testing purposes
    const mockCart = {
      token: 'test-token',
      item_count: 2,
      total_price: 5000,
      items: [
        { title: 'Test Product', image: '/placeholder.jpg' }
      ]
    };
    
    this.popupManager.showRecoveryPopup(mockCart);
  }
}

// Global functions for theme integration
window.captureRecoveryEmail = function(email) {
  if (window.cartRecoveryInstance) {
    window.cartRecoveryInstance.captureCustomerEmail(email);
  }
};

window.closeCartRecoveryPopup = function() {
  if (window.cartRecoveryInstance) {
    window.cartRecoveryInstance.popupManager.hidePopup();
  }
};

window.getRecoveryStats = function() {
  return window.cartRecoveryInstance?.getRecoveryStats() || {};
};

// Initialize when DOM is ready
function initCartRecoveryPro() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.cartRecoveryInstance = new CartRecoveryPro();
    });
  } else {
    window.cartRecoveryInstance = new CartRecoveryPro();
  }
}

initCartRecoveryPro();