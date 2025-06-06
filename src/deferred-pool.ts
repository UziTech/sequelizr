import {EventEmitter} from "node:events";

export class DeferredPool extends EventEmitter {
	max: number;

	retry: number;

	nextItem: number;

	items: {item: unknown, tries: number}[];

	currentItems: Set<unknown>;

	successfulItems: unknown[];

	failedItems: unknown[];

	constructor({max = 100, retry = 1} = {}) {
		super();
		this.max = max;
		this.retry = retry;
		this.nextItem = 0;
		this.items = [];
		this.currentItems = new Set();
		this.successfulItems = [];
		this.failedItems = [];
	}

	get total() {
		return this.items.length;
	}

	get successful() {
		return this.successfulItems.length;
	}

	get failed() {
		return this.failedItems.length;
	}

	get finished() {
		return this.successful + this.failed;
	}

	get percent() {
		return this.total > 0 ? this.finished / this.total * 100 : 0;
	}

	add(item: unknown, tries = 0) {
		if (Array.isArray(item)) {
			item.forEach(i => this.add(i, tries));
			return;
		}

		this.items.push({
			item,
			tries,
		});
		this.emit("update");
		this.next();
	}

	clear() {
		this.items = [];
		this.successfulItems = [];
		this.failedItems = [];
		this.emit("update");
	}

	next() {
		if (this.currentItems.size >= this.max) {
			return;
		}

		if (this.nextItem >= this.items.length) {
			return;
		}

		const {item, tries} = this.items[this.nextItem];
		let itemFunc = item as () => unknown;
		if (typeof item !== "function") {
			itemFunc = () => item;
		}
		this.nextItem++;
		this.currentItems.add(item);
		Promise.resolve(itemFunc()).then(() => {
			this.successfulItems.push(item);
		}, (err) => {
			this.failedItems.push(item);
			if (tries >= this.retry) {
				this.emit("error", err, item);
			} else {
				this.add(item, tries + 1);
			}
		}).then(() => {
			this.currentItems.delete(item);
			this.emit("update");
			this.next();
		});
	}

	onUpdate(callback: () => void) {
		return this.on("update", callback);
	}

	onError(callback: (ex: Error) => void) {
		return this.on("error", callback);
	}
}
