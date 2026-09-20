'use strict';

const { EventEmitter } = require('events');

class OperationBusyError extends Error {
  constructor(active, requested) {
    super(`DragonStrap is busy with ${active?.label || active?.kind || 'another operation'}.`);
    this.name = 'OperationBusyError';
    this.code = 'OPERATION_BUSY';
    this.active = active || null;
    this.requested = requested || null;
  }
}

class OperationCoordinator extends EventEmitter {
  constructor({ now = () => Date.now() } = {}) {
    super();
    this.now = now;
    this.active = null;
    this.sequence = 0;
  }

  getState() {
    return { busy:Boolean(this.active), active:this.active ? { ...this.active } : null };
  }

  acquire(kind, { label = null, destructive = true } = {}) {
    const normalized = String(kind || '').trim();
    if (!/^[a-z][a-z0-9.-]{1,63}$/.test(normalized)) throw new TypeError('Invalid operation kind.');
    if (destructive && this.active) throw new OperationBusyError(this.active, normalized);
    const operation = {
      id:`op-${this.now().toString(36)}-${(++this.sequence).toString(36)}`,
      kind:normalized,
      label:String(label || normalized),
      destructive:Boolean(destructive),
      startedAt:new Date(this.now()).toISOString()
    };
    if (operation.destructive) {
      this.active = operation;
      this.emit('change', this.getState());
    }
    let released = false;
    return {
      operation:{ ...operation },
      release:() => {
        if (released) return false;
        released = true;
        if (operation.destructive && this.active?.id === operation.id) {
          this.active = null;
          this.emit('change', this.getState());
        }
        return true;
      }
    };
  }

  async run(kind, options, task) {
    if (typeof options === 'function') { task = options; options = {}; }
    if (typeof task !== 'function') throw new TypeError('OperationCoordinator.run requires a task function.');
    let lease;
    try { lease = this.acquire(kind, options || {}); }
    catch (error) {
      if (error instanceof OperationBusyError) return { ok:false, code:error.code, message:error.message, active:error.active };
      throw error;
    }
    try { return await task(lease.operation); }
    finally { lease.release(); }
  }
}

module.exports = { OperationCoordinator, OperationBusyError };
