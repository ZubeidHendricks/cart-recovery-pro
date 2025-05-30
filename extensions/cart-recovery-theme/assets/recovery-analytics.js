/**
 * RecoveryAnalytics - Tracks cart recovery metrics and performance
 * Single responsibility: Collect and report recovery analytics
 */

class RecoveryAnalytics {
  constructor(config) {
    this.config = config;
    this.storageKey = 'cart_recovery_analytics';
  }

  trackAbandonment(cartData) {
    const event = {
      type: 'cart_abandoned',
      timestamp: Date.now(),
      cart_token: cartData.token,
      item_count: cartData.item_count,
      cart_value: cartData.total_price / 100,
      has_email: this.hasCustomerEmail(),
      page_url: window.location.href
    };

    this.storeEvent(event);
  }

  trackEmailSent(templateType, cartData) {
    const event = {
      type: 'recovery_email_sent',
      timestamp: Date.now(),
      template_type: templateType,
      cart_token: cartData.token,
      cart_value: cartData.total_price / 100
    };

    this.storeEvent(event);
  }

  trackPopupShown(cartData) {
    const event = {
      type: 'recovery_popup_shown',
      timestamp: Date.now(),
      cart_token: cartData.token,
      cart_value: cartData.total_price / 100
    };

    this.storeEvent(event);
  }

  trackEmailCaptured(email, cartData) {
    const event = {
      type: 'email_captured',
      timestamp: Date.now(),
      cart_token: cartData.token,
      cart_value: cartData.total_price / 100,
      capture_method: 'popup'
    };

    this.storeEvent(event);
  }

  trackRecovery(cartData, recoveryMethod = 'unknown') {
    const event = {
      type: 'cart_recovered',
      timestamp: Date.now(),
      cart_token: cartData.token,
      cart_value: cartData.total_price / 100,
      recovery_method: recoveryMethod
    };

    this.storeEvent(event);
  }

  storeEvent(event) {
    const events = this.getStoredEvents();
    events.push(event);
    
    // Keep only last 1000 events to prevent storage bloat
    if (events.length > 1000) {
      events.splice(0, events.length - 1000);
    }
    
    localStorage.setItem(this.storageKey, JSON.stringify(events));
    
    // Send to external analytics if configured
    if (this.config.webhookUrl) {
      this.sendToWebhook(event);
    }
  }

  getStoredEvents() {
    try {
      return JSON.parse(localStorage.getItem(this.storageKey) || '[]');
    } catch (error) {
      console.error('Failed to parse analytics data:', error);
      return [];
    }
  }

  async sendToWebhook(event) {
    try {
      await fetch(this.config.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event)
      });
    } catch (error) {
      console.error('Analytics webhook failed:', error);
    }
  }

  getRecoveryStats(days = 30) {
    const events = this.getStoredEvents();
    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
    const recentEvents = events.filter(e => e.timestamp > cutoffTime);

    const stats = {
      abandoned: recentEvents.filter(e => e.type === 'cart_abandoned').length,
      recovered: recentEvents.filter(e => e.type === 'cart_recovered').length,
      emails_sent: recentEvents.filter(e => e.type === 'recovery_email_sent').length,
      popups_shown: recentEvents.filter(e => e.type === 'recovery_popup_shown').length,
      emails_captured: recentEvents.filter(e => e.type === 'email_captured').length,
      total_revenue: 0,
      recovery_rate: 0
    };

    // Calculate revenue and recovery rate
    const recoveredEvents = recentEvents.filter(e => e.type === 'cart_recovered');
    stats.total_revenue = recoveredEvents.reduce((sum, e) => sum + (e.cart_value || 0), 0);
    
    if (stats.abandoned > 0) {
      stats.recovery_rate = ((stats.recovered / stats.abandoned) * 100).toFixed(2);
    }

    return stats;
  }

  getTopRecoveryMethods(days = 30) {
    const events = this.getStoredEvents();
    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
    const recoveries = events.filter(e => 
      e.type === 'cart_recovered' && 
      e.timestamp > cutoffTime
    );

    const methodCounts = {};
    recoveries.forEach(recovery => {
      const method = recovery.recovery_method || 'unknown';
      methodCounts[method] = (methodCounts[method] || 0) + 1;
    });

    return Object.entries(methodCounts)
      .sort(([,a], [,b]) => b - a)
      .map(([method, count]) => ({ method, count }));
  }

  hasCustomerEmail() {
    return !!(
      localStorage.getItem('cart_recovery_email') ||
      window.ShopifyAnalytics?.meta?.page?.customerEmail
    );
  }

  exportData() {
    const events = this.getStoredEvents();
    const stats = this.getRecoveryStats();
    
    return {
      events,
      stats,
      export_timestamp: Date.now(),
      total_events: events.length
    };
  }

  clearData() {
    localStorage.removeItem(this.storageKey);
  }
}

window.RecoveryAnalytics = RecoveryAnalytics;