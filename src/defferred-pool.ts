import { EventEmitter } from "events";

// Define a type for the items stored in the pool
// T is the type of the item itself, can be a function or any value
type PoolItem<T = any> = {
	item: T | (() => T) | (() => Promise<T>); // Item can be a value, a function, or a promise-returning function
	tries: number;
};

// Define an interface for constructor options
interface DeferredPoolOptions {
	max?: number;
	retry?: number;
}

class DeferredPool<T = any> extends EventEmitter {
	private max: number;
	private retry: number;
	private nextItem: number;
	private items: PoolItem<T>[];
	private currentItems: Set<T | (() => T) | (() => Promise<T>)>; // Stores the actual item or function
	private successfulItems: (T | (() => T) | (() => Promise<T>))[];
	private failedItems: (T | (() => T) | (() => Promise<T>))[];

	constructor({ max = 100, retry = 1 }: DeferredPoolOptions = {}) {
		super();
		this.max = max;
		this.retry = retry;
		this.nextItem = 0;
		this.items = [];
		this.currentItems = new Set();
		this.successfulItems = [];
		this.failedItems = [];
	}

	get total(): number {
		return this.items.length;
	}

	get successful(): number {
		return this.successfulItems.length;
	}

	get failed(): number {
		return this.failedItems.length;
	}

	get finished(): number {
		return this.successful + this.failed;
	}

	get percent(): number {
		return this.total > 0 ? (this.finished / this.total) * 100 : 0;
	}

	add(item: T | (() => T) | (() => Promise<T>) | (T | (() => T) | (() => Promise<T>))[], tries: number = 0): void {
		if (Array.isArray(item)) {
			item.forEach((i) => this.add(i, tries));
			return;
		}

		this.items.push({
			item,
			tries,
		});
		this.emit("update");
		this.next();
	}

	clear(): void {
		this.items = [];
		this.successfulItems = [];
		this.failedItems = [];
		this.emit("update");
	}

	private next(): void {
		if (this.currentItems.size >= this.max) {
			return;
		}

		if (this.nextItem >= this.items.length) {
			if (this.currentItems.size === 0 && this.items.length > 0 && this.finished === this.total) {
				this.emit("done"); // Emit a 'done' event when all items are processed
			}
			return;
		}

		const poolEntry = this.items[this.nextItem];
		const { item, tries } = poolEntry;

		let itemFunc: () => Promise<T>;

		if (typeof item === "function") {
			// To handle both (() => T) and (() => Promise<T>)
			// We wrap it to ensure it returns a Promise
			itemFunc = () => Promise.resolve((item as () => T | Promise<T>)());
		} else {
			itemFunc = () => Promise.resolve(item as T);
		}

		this.nextItem++;
		this.currentItems.add(item);

		Promise.resolve(itemFunc())
			.then((result) => { // Added result here, though not used in current logic, it's good practice
				this.successfulItems.push(item);
			})
			.catch((err: any) => { // Explicitly type err as any or Error
				this.failedItems.push(item);
				if (tries >= this.retry) {
					this.emit("error", err, item);
				} else {
					// Re-add to the end of the items array for retry
					this.items.push({ item, tries: tries + 1 });
					// Do not call this.add() as it would re-trigger 'update' and 'next' immediately
					// in a way that might not be intended for retries.
					// Instead, we've added it to items, and the main next() loop will pick it up.
					// However, the original logic was this.add(), let's stick to it for now.
					// Reverting to original retry logic:
					this.add(item, tries + 1);
					// Remove the just failed item from failedItems as it's being retried
                    this.failedItems.splice(this.failedItems.indexOf(item), 1);

				}
			})
			.finally(() => { // Use finally to ensure cleanup
				this.currentItems.delete(item);
				this.emit("update");
				this.next();
			});
	}

	onUpdate(callback: () => void): this {
		return this.on("update", callback);
	}

	onError(callback: (error: Error, item: T | (() => T) | (() => Promise<T>)) => void): this {
		return this.on("error", callback);
	}

	onDone(callback: () => void): this {
		return this.on("done", callback);
	}
}

export default DeferredPool;
