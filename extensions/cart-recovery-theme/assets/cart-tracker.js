/**
 * CartTracker - Core cart abandonment detection
 * Tracks cart changes and identifies abandonment patterns
 */

class CartTracker {
  constructor(config) {
    this.config = config;
    this.currentCart = null;
    this.lastActivity = Date.now();
    this.abandonmentTimer = null;
    this.callbacks = [];
    this.isTracking = false;
  }

  init() {
    this.getCurrentCart();
    this.startTracking();
    this.bindEvents();
    console.log('CartTracker initialized');
  }

  async getCurrentCart() {
    try {
      const response = await fetch('/cart.json');
      this.currentCart = await response.json();
      this.updateLastActivity();
    } catch (error) {
      console.error('Failed to get cart:', error);
    }
  }

  startTracking() {
    if (this.isTracking) return;
    
    this.isTracking = true;
    
    // Check for cart changes every 30 seconds
    setInterval(() => {
      this.checkCartChanges();
    }, 30000);
    
    // Check for abandonment every minute
    setInterval(() => {
      this.checkAbandonment();
    }, 60000);
  }

  async checkCartChanges() {
    const previousCart = this.currentCart;
    await this.getCurrentCart();
    
    if (this.hasCartChanged(previousCart, this.currentCart)) {
      this.updateLastActivity();
      this.triggerCartChange(this.currentCart);
    }
  }

  hasCartChanged(oldCart, newCart) {
    if (!oldCart || !newCart) return true;
    
    return (
      oldCart.item_count !== newCart.item_count ||
      oldCart.total_price !== newCart.total_price ||
      JSON.stringify(oldCart.items) !== JSON.stringify(newCart.items)
    );
  }

  checkAbandonment() {
    const timeSinceActivity = Date.now() - this.lastActivity;
    const abandonmentThreshold = this.config.abandonmentMinutes * 60 * 1000;
    
    if (
      timeSinceActivity >= abandonmentThreshold &&
      this.currentCart &&
      this.currentCart.item_count > 0 &&
      !this.isOnCheckoutPage()
    ) {
      this.triggerAbandonment(this.currentCart);
    }
  }

  isOnCheckoutPage() {
    return window.location.pathname.includes('/checkout') ||
           window.location.pathname.includes('/cart');
  }

  updateLastActivity() {
    this.lastActivity = Date.now();
    
    // Clear existing abandonment timer
    if (this.abandonmentTimer) {
      clearTimeout(this.abandonmentTimer);
    }
    
    // Set new abandonment timer
    this.abandonmentTimer = setTimeout(() => {
      if (this.currentCart && this.currentCart.item_count > 0) {
        this.triggerAbandonment(this.currentCart);
      }
    }, this.config.abandonmentMinutes * 60 * 1000);
  }

  triggerCartChange(cart) {
    this.callbacks.forEach(callback => {
      if (callback.type === 'change') {
        callback.fn(cart);
      }
    });
  }

  triggerAbandonment(cart) {
    this.callbacks.forEach(callback => {
      if (callback.type === 'abandonment') {
        callback.fn(cart);
      }
    });
  }

  onCartChange(callback) {
    this.callbacks.push({ type: 'change', fn: callback });
  }

  onAbandonment(callback) {
    this.callbacks.push({ type: 'abandonment', fn: callback });
  }

  bindEvents() {
    // Track cart button clicks
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-add-to-cart], .btn-add-to-cart, button[name="add"]')) {
        setTimeout(() => this.getCurrentCart(), 1000);
        this.updateLastActivity();
      }
    });

    // Track page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.updateLastActivity();
      }
    });

    // Track mouse/keyboard activity
    ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
      document.addEventListener(event, () => {
        this.updateLastActivity();
      }, { passive: true });
    });
  }

  // Get cart data for recovery
  getCartRecoveryData() {
    if (!this.currentCart || this.currentCart.item_count === 0) {
      return null;
    }

    return {
      cart: this.currentCart,
      customerEmail: this.getCustomerEmail(),
      timestamp: Date.now(),
      recoveryUrl: this.generateRecoveryUrl(),
      value: this.currentCart.total_price / 100
    };
  }

  getCustomerEmail() {
    // Try to get email from customer account
    if (window.ShopifyAnalytics?.meta?.page?.customerId) {
      return window.ShopifyAnalytics.meta.page.customerEmail;
    }
    
    // Try to get from checkout form if available
    const emailInput = document.querySelector('input[type="email"]');
    if (emailInput && emailInput.value) {
      return emailInput.value;
    }
    
    // Try localStorage for previously captured emails
    return localStorage.getItem('cartRecovery_email');
  }

  generateRecoveryUrl() {
    const baseUrl = window.location.origin;
    const cartToken = this.currentCart.token;
    return `${baseUrl}/cart/${cartToken}`;
  }
}

window.CartTracker = CartTracker;