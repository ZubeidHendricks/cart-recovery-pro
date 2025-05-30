/**
 * AbandonmentDetector - Detects when carts are abandoned
 * Single responsibility: Monitor cart state and detect abandonment
 */

class AbandonmentDetector {
  constructor(config) {
    this.config = config;
    this.lastActivity = Date.now();
    this.currentCart = null;
    this.callbacks = [];
    this.checkInterval = null;
  }

  init() {
    this.startMonitoring();
    this.bindActivityEvents();
  }

  startMonitoring() {
    // Check cart status every minute
    this.checkInterval = setInterval(() => {
      this.checkForAbandonment();
    }, 60 * 1000);
  }

  async checkForAbandonment() {
    await this.updateCartState();
    
    const timeSinceActivity = Date.now() - this.lastActivity;
    const threshold = this.config.abandonmentMinutes * 60 * 1000;
    
    if (this.shouldTriggerAbandonment(timeSinceActivity, threshold)) {
      this.triggerAbandonment();
    }
  }

  shouldTriggerAbandonment(timeSinceActivity, threshold) {
    return (
      timeSinceActivity >= threshold &&
      this.currentCart &&
      this.currentCart.item_count > 0 &&
      !this.isOnCheckoutPage()
    );
  }

  async updateCartState() {
    try {
      const response = await fetch('/cart.json');
      this.currentCart = await response.json();
    } catch (error) {
      console.error('Failed to fetch cart:', error);
    }
  }

  isOnCheckoutPage() {
    return window.location.pathname.includes('/checkout');
  }

  bindActivityEvents() {
    ['click', 'scroll', 'keypress', 'mousemove'].forEach(event => {
      document.addEventListener(event, () => {
        this.updateActivity();
      }, { passive: true });
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.updateActivity();
      }
    });
  }

  updateActivity() {
    this.lastActivity = Date.now();
  }

  triggerAbandonment() {
    this.callbacks.forEach(callback => callback(this.currentCart));
  }

  onAbandonment(callback) {
    this.callbacks.push(callback);
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}

window.AbandonmentDetector = AbandonmentDetector;