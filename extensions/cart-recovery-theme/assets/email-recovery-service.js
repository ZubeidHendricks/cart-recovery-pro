/**
 * EmailRecoveryService - Handles email-based cart recovery
 * Single responsibility: Send recovery emails with timing optimization
 */

class EmailRecoveryService {
  constructor(config) {
    this.config = config;
    this.templates = {
      immediate: {
        subject: "You left something in your cart!",
        body: "Don't miss out on these items. Complete your purchase now!"
      },
      reminder: {
        subject: "Still thinking about your cart?",
        body: "Here's 10% off to help you decide. Use code: CART10"
      },
      final: {
        subject: "Last chance - your cart expires soon!",
        body: "Your items are almost gone! Save 15% with code: FINAL15"
      }
    };
  }

  async sendRecoverySequence(cartData, customerEmail) {
    if (!customerEmail || !this.config.emailEnabled) return;

    const sequence = {
      cartData,
      customerEmail,
      startTime: Date.now()
    };

    // Schedule emails based on cart value
    const timings = this.calculateTimings(cartData.total_price);
    
    if (this.config.sendImmediate) {
      setTimeout(() => this.sendEmail(sequence, 'immediate'), timings.immediate);
    }
    
    if (this.config.sendReminder) {
      setTimeout(() => this.sendEmail(sequence, 'reminder'), timings.reminder);
    }
    
    if (this.config.sendFinal) {
      setTimeout(() => this.sendEmail(sequence, 'final'), timings.final);
    }
  }

  calculateTimings(cartValue) {
    // High-value carts get faster follow-ups
    const isHighValue = cartValue > (this.config.highValueThreshold * 100);
    
    return isHighValue ? {
      immediate: 30 * 60 * 1000,    // 30 minutes
      reminder: 2 * 60 * 60 * 1000, // 2 hours
      final: 24 * 60 * 60 * 1000    // 24 hours
    } : {
      immediate: 60 * 60 * 1000,      // 1 hour
      reminder: 24 * 60 * 60 * 1000,  // 24 hours
      final: 72 * 60 * 60 * 1000     // 72 hours
    };
  }

  async sendEmail(sequence, templateType) {
    const template = this.templates[templateType];
    const personalizedContent = this.personalizeTemplate(template, sequence);
    
    try {
      await this.submitToShopify({
        email: sequence.customerEmail,
        subject: personalizedContent.subject,
        body: personalizedContent.body,
        cartToken: sequence.cartData.token,
        templateType
      });
      
      console.log(`Recovery email sent: ${templateType}`);
    } catch (error) {
      console.error(`Failed to send ${templateType} email:`, error);
    }
  }

  personalizeTemplate(template, sequence) {
    const cart = sequence.cartData;
    
    return {
      subject: template.subject,
      body: template.body
        .replace('{{item_count}}', cart.item_count)
        .replace('{{total_price}}', (cart.total_price / 100).toFixed(2))
        .replace('{{recovery_url}}', this.generateRecoveryUrl(cart.token))
    };
  }

  generateRecoveryUrl(cartToken) {
    return `${window.location.origin}/cart/${cartToken}`;
  }

  async submitToShopify(emailData) {
    const response = await fetch('/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'form_type': 'cart_recovery',
        'email': emailData.email,
        'subject': emailData.subject,
        'body': emailData.body,
        'cart_token': emailData.cartToken,
        'template_type': emailData.templateType
      })
    });

    if (!response.ok) {
      throw new Error(`Email submission failed: ${response.status}`);
    }

    return response;
  }
}

window.EmailRecoveryService = EmailRecoveryService;