(function () {
  'use strict';
  if (window.xrpl && typeof window.xrpl.Client === 'function') return;

  class NativeXRPLClient {
    constructor(url, options = {}) {
      this.url = String(url || '');
      this.connectionTimeout = Number(options.connectionTimeout || 10000);
      this.socket = null;
      this.pending = new Map();
      this.nextId = 1;
      this.connecting = null;
    }

    isConnected() {
      return Boolean(this.socket && this.socket.readyState === WebSocket.OPEN);
    }

    async connect() {
      if (this.isConnected()) return;
      if (this.connecting) return this.connecting;

      this.connecting = new Promise((resolve, reject) => {
        const socket = new WebSocket(this.url);
        const timeout = window.setTimeout(() => {
          try { socket.close(); } catch {}
          reject(new Error('XRPL connection timed out.'));
        }, this.connectionTimeout);

        const cleanupOpen = () => window.clearTimeout(timeout);

        socket.addEventListener('open', () => {
          cleanupOpen();
          this.socket = socket;
          resolve();
        }, { once: true });

        socket.addEventListener('error', () => {
          cleanupOpen();
          reject(new Error('XRPL WebSocket connection failed.'));
        }, { once: true });

        socket.addEventListener('message', event => {
          let message;
          try { message = JSON.parse(event.data); } catch { return; }
          const id = String(message.id ?? '');
          const pending = this.pending.get(id);
          if (!pending) return;
          this.pending.delete(id);
          window.clearTimeout(pending.timeout);
          if (message.status === 'error' || message.error || message.result?.error) {
            pending.reject(new Error(
              message.result?.error_message || message.error_message ||
              message.result?.error || message.error || 'XRPL request failed.'
            ));
          } else {
            pending.resolve(message);
          }
        });

        socket.addEventListener('close', () => {
          for (const pending of this.pending.values()) {
            window.clearTimeout(pending.timeout);
            pending.reject(new Error('XRPL WebSocket closed before the response arrived.'));
          }
          this.pending.clear();
          if (this.socket === socket) this.socket = null;
        });
      }).finally(() => { this.connecting = null; });

      return this.connecting;
    }

    async request(request) {
      await this.connect();
      const id = String(this.nextId++);
      const payload = { id, ...(request || {}) };
      return new Promise((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          this.pending.delete(id);
          reject(new Error('XRPL request timed out.'));
        }, 15000);
        this.pending.set(id, { resolve, reject, timeout });
        try {
          this.socket.send(JSON.stringify(payload));
        } catch (error) {
          window.clearTimeout(timeout);
          this.pending.delete(id);
          reject(error);
        }
      });
    }

    async disconnect() {
      if (!this.socket) return;
      const socket = this.socket;
      this.socket = null;
      try { socket.close(1000, 'Page lifecycle'); } catch {}
    }
  }

  window.xrpl = Object.assign({}, window.xrpl || {}, { Client: NativeXRPLClient });
}());
