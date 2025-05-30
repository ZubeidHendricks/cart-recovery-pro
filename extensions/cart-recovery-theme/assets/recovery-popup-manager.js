/**
 * RecoveryPopupManager - Manages exit-intent recovery popups
 * Single responsibility: Show/hide recovery popups with cart data
 */

class RecoveryPopupManager {
  constructor(config) {
    this.config = config;
    this.isPopupVisible = false;
    this.popupElement = null;
  }

  init() {
    this.popupElement = document.getElementById('cart-recovery-popup');
    this.bindEvents();
  }

  showRecoveryPopup(cartData, customerEmail = null) {
    if (!this.config.showExitPopup || this.isPopupVisible || !this.popupElement) {
      return;
    }

    this.updatePopupContent(cartData);
    this.displayPopup();
    this.isPopupVisible = true;
  }

  updatePopupContent(cartData) {
    // Update item count
    const itemCount = this.popupElement.querySelector('[data-item-count]');
    if (itemCount) {
      itemCount.textContent = cartData.item_count;
    }

    // Update total price
    const totalPrice = this.popupElement.querySelector('[data-total-price]');
    if (totalPrice) {
      totalPrice.textContent = (cartData.total_price / 100).toFixed(2);
    }

    // Update product images
    this.updateProductImages(cartData.items);

    // Update recovery button
    const recoveryButton = this.popupElement.querySelector('[data-recovery-url]');
    if (recoveryButton) {
      recoveryButton.href = this.generateRecoveryUrl(cartData.token);
    }
  }

  updateProductImages(items) {
    const imageContainer = this.popupElement.querySelector('[data-product-images]');
    if (!imageContainer || !items.length) return;

    const imageHtml = items.slice(0, 3).map(item => 
      `<img src="${item.image}" alt="${item.title}" class="recovery-product-image">`
    ).join('');

    imageContainer.innerHTML = imageHtml;
  }

  displayPopup() {
    this.popupElement.style.display = 'flex';
    
    requestAnimationFrame(() => {
      this.popupElement.classList.add('show');
    });

    document.body.style.overflow = 'hidden';

    // Auto-hide after configured time
    if (this.config.popupAutoHide > 0) {
      setTimeout(() => {
        this.hidePopup();
      }, this.config.popupAutoHide * 1000);
    }
  }

  hidePopup() {
    if (!this.isPopupVisible) return;

    this.popupElement.classList.remove('show');
    
    setTimeout(() => {
      this.popupElement.style.display = 'none';
      document.body.style.overflow = '';
      this.isPopupVisible = false;
    }, 300);
  }

  generateRecoveryUrl(cartToken) {
    return `${window.location.origin}/cart/${cartToken}`;
  }

  bindEvents() {
    // Close button handler
    document.addEventListener('click', (e) => {
      if (e.target.matches('.cart-recovery-close')) {
        this.hidePopup();
      }
    });

    // Overlay click handler
    document.addEventListener('click', (e) => {
      if (e.target.matches('.cart-recovery-popup')) {
        this.hidePopup();
      }
    });

    // Email capture handler
    document.addEventListener('submit', (e) => {
      if (e.target.matches('.cart-recovery-email-form')) {
        e.preventDefault();
        this.handleEmailCapture(e.target);
      }
    });

    // Escape key handler
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isPopupVisible) {
        this.hidePopup();
      }
    });
  }

  handleEmailCapture(form) {
    const email = form.querySelector('input[type="email"]').value;
    
    if (!email) return;

    // Store email for recovery
    localStorage.setItem('cart_recovery_email', email);

    // Show success message
    this.showEmailSuccess();

    // Hide popup after delay
    setTimeout(() => {
      this.hidePopup();
    }, 2000);
  }

  showEmailSuccess() {
    const successMsg = this.popupElement.querySelector('.email-success');
    if (successMsg) {
      successMsg.style.display = 'block';
    }
  }
}

window.RecoveryPopupManager = RecoveryPopupManager;