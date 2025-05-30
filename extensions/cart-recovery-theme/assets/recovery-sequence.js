/**
 * RecoverySequence - Manages automated recovery campaigns
 * Handles email/SMS sequences with AI timing optimization
 */

class RecoverySequence {
  constructor(config) {
    this.config = config;
    this.activeSequences = new Map();
    this.templates = {
      email: {
        immediate: {
          subject: "You left something in your cart!",
          body: "Don't miss out on these items. Complete your purchase now and save!"
        },
        followup1: {
          subject: "Still thinking about your cart?",
          body: "Here's 10% off to help you decide. Use code: SAVE10"
        },
        followup2: {
          subject: "Last chance - your cart expires soon!",
          body: "Your items are almost gone! Complete your purchase with 15% off: SAVE15"
        }
      },
      sms: {
        immediate: "Hey! You left {{item_count}} items in your cart. Complete your order: {{recovery_url}}",
        followup1: "Still interested? Get 10% off your cart with code SAVE10: {{recovery_url}}",
        followup2: "Last chance! Your cart expires in 24 hours. Save 15% with SAVE15: {{recovery_url}}"
      }
    };
  }

  startSequence(cartData) {
    if (!cartData || !cartData.customerEmail) {
      console.log('No email available for recovery sequence');
      return;
    }

    const sequenceId = this.generateSequenceId(cartData);
    
    // Check if sequence already running for this cart
    if (this.activeSequences.has(sequenceId)) {
      console.log('Recovery sequence already active for this cart');
      return;
    }

    const sequence = {
      id: sequenceId,
      cartData: cartData,
      startTime: Date.now(),
      status: 'active',
      messages: [],
      nextAction: null
    };

    this.activeSequences.set(sequenceId, sequence);
    this.scheduleMessages(sequence);
    
    console.log('Started recovery sequence:', sequenceId);
  }

  scheduleMessages(sequence) {
    const timings = this.getOptimalTimings(sequence.cartData);
    
    // Schedule immediate message (if enabled)
    if (this.config.sendImmediate) {
      this.scheduleMessage(sequence, 'immediate', timings.immediate);
    }
    
    // Schedule follow-up messages
    if (this.config.sendFollowup1) {
      this.scheduleMessage(sequence, 'followup1', timings.followup1);
    }
    
    if (this.config.sendFollowup2) {
      this.scheduleMessage(sequence, 'followup2', timings.followup2);
    }
  }

  getOptimalTimings(cartData) {
    // AI-optimized timing based on cart value and customer behavior
    const baseValue = cartData.value;
    const isHighValue = baseValue > this.config.highValueThreshold;
    
    // High-value carts get more aggressive timing
    if (isHighValue) {
      return {
        immediate: 30 * 60 * 1000,    // 30 minutes
        followup1: 2 * 60 * 60 * 1000, // 2 hours  
        followup2: 24 * 60 * 60 * 1000 // 24 hours
      };
    }
    
    // Standard timing for regular carts
    return {
      immediate: 60 * 60 * 1000,      // 1 hour
      followup1: 24 * 60 * 60 * 1000, // 24 hours
      followup2: 72 * 60 * 60 * 1000  // 72 hours
    };
  }

  scheduleMessage(sequence, type, delay) {
    const messageId = `${sequence.id}_${type}`;
    
    setTimeout(() => {
      this.sendMessage(sequence, type);
    }, delay);
    
    sequence.messages.push({
      id: messageId,
      type: type,
      scheduledAt: Date.now() + delay,
      status: 'scheduled'
    });
  }

  async sendMessage(sequence, type) {
    if (sequence.status !== 'active') {
      console.log('Sequence no longer active, skipping message');
      return;
    }

    // Check if cart was recovered
    if (await this.isCartRecovered(sequence.cartData)) {
      this.completeSequence(sequence.id, 'recovered');
      return;
    }

    // Send email
    if (this.config.emailEnabled) {
      await this.sendEmail(sequence, type);
    }

    // Send SMS (if enabled and phone available)
    if (this.config.smsEnabled && sequence.cartData.customerPhone) {
      await this.sendSMS(sequence, type);
    }

    // Update message status
    const message = sequence.messages.find(m => m.type === type);
    if (message) {
      message.status = 'sent';
      message.sentAt = Date.now();
    }

    // Track analytics
    this.trackMessage(sequence, type);
  }

  async sendEmail(sequence, type) {
    const template = this.templates.email[type];
    const cartData = sequence.cartData;
    
    const emailData = {
      to: cartData.customerEmail,
      subject: this.personalizeText(template.subject, cartData),
      body: this.personalizeText(template.body, cartData),
      cartData: cartData,
      discountCode: this.generateDiscountCode(type),
      recoveryUrl: cartData.recoveryUrl
    };

    try {
      // Send via Shopify's email system or third-party service
      await this.submitEmail(emailData);
      console.log('Recovery email sent:', type);
    } catch (error) {
      console.error('Failed to send recovery email:', error);
    }
  }

  async sendSMS(sequence, type) {
    const template = this.templates.sms[type];
    const cartData = sequence.cartData;
    
    const message = this.personalizeText(template, cartData);
    
    try {
      // Send via SMS service (would integrate with Twilio, etc.)
      await this.submitSMS(cartData.customerPhone, message);
      console.log('Recovery SMS sent:', type);
    } catch (error) {
      console.error('Failed to send recovery SMS:', error);
    }
  }

  personalizeText(text, cartData) {
    return text
      .replace('{{item_count}}', cartData.cart.item_count)
      .replace('{{total_price}}', (cartData.cart.total_price / 100).toFixed(2))
      .replace('{{recovery_url}}', cartData.recoveryUrl)
      .replace('{{customer_name}}', cartData.customerName || 'there');
  }

  generateDiscountCode(messageType) {
    const discounts = {
      immediate: null,
      followup1: 'SAVE10',
      followup2: 'SAVE15'
    };
    
    return discounts[messageType];
  }

  async isCartRecovered(cartData) {
    try {
      // Check if cart still exists and has items
      const response = await fetch(`/cart.json`);
      const currentCart = await response.json();
      
      // If cart is empty or different, consider it recovered
      return currentCart.item_count === 0 || 
             currentCart.token !== cartData.cart.token;
    } catch (error) {
      return false;
    }
  }

  completeSequence(sequenceId, reason = 'completed') {
    const sequence = this.activeSequences.get(sequenceId);
    if (sequence) {
      sequence.status = reason;
      sequence.completedAt = Date.now();
      
      // Track completion
      this.trackCompletion(sequence, reason);
      
      // Remove from active sequences after 24 hours
      setTimeout(() => {
        this.activeSequences.delete(sequenceId);
      }, 24 * 60 * 60 * 1000);
    }
  }

  generateSequenceId(cartData) {
    return `cart_${cartData.cart.token}_${cartData.timestamp}`;
  }

  async submitEmail(emailData) {
    // Submit to Shopify or email service
    const response = await fetch('/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'form_type': 'cart_recovery',
        'email': emailData.to,
        'subject': emailData.subject,
        'body': emailData.body,
        'cart_token': emailData.cartData.cart.token
      })
    });
    
    return response.ok;
  }

  async submitSMS(phone, message) {
    // Would integrate with SMS service like Twilio
    console.log('SMS would be sent:', { phone, message });
    return true;
  }

  trackMessage(sequence, type) {
    // Track message analytics
    const analytics = {
      event: 'recovery_message_sent',
      sequence_id: sequence.id,
      message_type: type,
      cart_value: sequence.cartData.value,
      timestamp: Date.now()
    };
    
    // Send to analytics service
    this.sendAnalytics(analytics);
  }

  trackCompletion(sequence, reason) {
    const analytics = {
      event: 'recovery_sequence_completed',
      sequence_id: sequence.id,
      completion_reason: reason,
      messages_sent: sequence.messages.filter(m => m.status === 'sent').length,
      cart_value: sequence.cartData.value,
      duration: Date.now() - sequence.startTime,
      timestamp: Date.now()
    };
    
    this.sendAnalytics(analytics);
  }

  sendAnalytics(data) {
    // Send to analytics service or store locally
    console.log('Analytics:', data);
    
    // Store in localStorage for now
    const analytics = JSON.parse(localStorage.getItem('cartRecovery_analytics') || '[]');
    analytics.push(data);
    localStorage.setItem('cartRecovery_analytics', JSON.stringify(analytics));
  }

  // Admin methods for viewing sequences
  getActiveSequences() {
    return Array.from(this.activeSequences.values());
  }

  getSequenceById(id) {
    return this.activeSequences.get(id);
  }

  cancelSequence(id) {
    const sequence = this.activeSequences.get(id);
    if (sequence) {
      this.completeSequence(id, 'cancelled');
    }
  }
}

window.RecoverySequence = RecoverySequence;