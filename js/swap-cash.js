const p = new DOMParser();
const html = (ss, ...parts) => p.parseFromString('<template>' + parts
	.reduce((t, val, i) => `${t}${strings[i]}${val}`, '')
	.concat(ss[parts.length])
+ '</template>', 'text/html').querySelector('template');

const entries = o => o[Symbol.iterator] ? [...o] : [...Object.entries(o)];
const changes = (o, n) => {
	let old = Object.fromEntries(entries(o));
	return entries(n).filter(([k, v]) => Object.hasOwn(old, k) && old[k] != v)
};

const swapTpl = html`
<style>
:host {
	--sw-size: 22px;
	--input-rad: 1rem;
	display: flex; flex-direction: column;
	position: relative;
}

.field {
	flex: 1;
	display: flex; flex-direction: column;
	background: var(--color-fg);
	border-radius: var(--input-rad);
	box-sizing: border-box;
	padding: 12px calc(10px + 1vw) 5px;
	margin: 2px 0;
}
.field>div { display: flex; align-items: center; }

#to, #from { flex: 4; }
.message {
	flex: 2;
	font-size: 0.8em;
	margin-top: 4px;
	min-height: 1rem;
	line-height: 1rem;
}

#switch {
	background: var(--color-alt);
	border-radius: 10px;
	border: solid 3px var(--color-bg);
	box-sizing: content-box;
	display: flex; align-items: center; justify-content: center;
	height: var(--sw-size); width: var(--sw-size);
	margin-left: calc((-1*var(--sw-size) / 2) - 4px);
	margin-top: calc((-1*var(--sw-size) / 2) - 4px);
	padding: 0;
	position: absolute;
	top: 50%; left: 50%;
}
#switch svg { width: 50%; }

::slotted(input), input {
	all: initial;
	-moz-appearance: textfield;
	color: var(--color-alt);
	flex: 1;
	font-family: 'DM Mono', monospace;
	font-size: calc(1.1em + 1vw);
	margin-right: 5px;
	min-width: 0;
}
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
::slotted(select), select {
	background: var(--color-bg);
	border-radius: 5px;
	border: none;
	box-sizing: border-box;
	color: var(--color-alt);
	padding: .3rem 0 .3rem .5rem;
	height: 100%;
	max-height: 3rem;
}
</style>
<!-- ----- end of styles ----- -->

<div class="field">
	<div id="from">
		<slot name="amount">
			<input type="number" placeholder="0.00" min="0" step=".001" required />
		</slot>
		<slot name="from-select">
			<select><option disabled selected>---</option></select>
		</slot>
	</div>
	<div class="message"></div>
</div>
<div class="field">
	<div id="to">
		<input type="number" placeholder="0.00" min="0" step=".001" required />
		<slot name="to-select">
			<select><option disabled selected>---</option></select>
		</slot>
	</div>
	<div class="message"></div>
</div>

<button id="switch">
	<svg width="8" height="8" fill="var(--color-accent)" viewBox="0 0 8 8">
		<path d="m0.2 4.5 3.3 3.3c0.17 0.17 0.44 0.24 0.67 0.16 0.12-0.036 0.22-0.1 0.31-0.19 1.1-1.1 2.2-2.2 3.3-3.3 0.16-0.17 0.23-0.42 0.17-0.65-0.06-0.22-0.25-0.41-0.47-0.47-0.22-0.061-0.47 0.0052-0.64 0.17-0.73 0.74-1.5 1.5-2.2 2.2-3.4e-5 -1.7 6.8e-5 -3.4-5.1e-5 -5.1-8e-4 -0.23-0.14-0.46-0.34-0.57-0.2-0.12-0.46-0.12-0.66 4e-3 -0.2 0.12-0.33 0.34-0.33 0.58v5.1c-0.74-0.74-1.5-1.5-2.2-2.2-0.16-0.16-0.42-0.22-0.64-0.16-0.24 0.066-0.44 0.28-0.48 0.53-0.038 0.21 0.034 0.44 0.19 0.59z"/>
	</svg>
</button>
`

export class Swap extends HTMLElement {
	static tag = 'swap-x';
	static observedAttributes = ['rate'];
	static formAssociated = true;

	#$$;
	#$ = {};
	#state = { amount: 0, from: '', to: '', rate: 1 };
	#internals = null;
	#raf = null;
	#$src = null;

	#onInput = e => {
		if (!e.isTrusted) return;
		e.stopPropagation();

		this.#$src = e.target;
		if (this.#$src instanceof HTMLInputElement) {
			let amount = this.#$src === this.#$.output ?
				(this.#$src.value / this.rate).toFixed(3) : this.#$src.value;
			this.update({amount});
			requestAnimationFrame(() => {
				this.#$.amount.dispatchEvent(new Event('input', { bubbles: true }));
			});
		} else {
			this[this.#$src.name] = this.#$src.value;
			this.dispatchEvent(new CustomEvent('pair-change', { detail: this.pair }));
		}
	};
	#switchPair = ({target}) => {
		let to = this.#$.to, from = this.#$.from;
		this.#$.to = from; this.#$.from = to;
		this.#$.from.setAttribute('slot', 'from-select');
		this.#$.to.setAttribute('slot', 'to-select');
		this.#internals?.setFormValue(this.value);

		this.update({from: this.to, to: this.from, rate: 1 / this.rate});
		this.#$.swBtn.firstElementChild
			.animate([{ transform: 'rotateX(360deg)' }], 350);
	};

	constructor() {
		super();
		this.#$$ = this.attachShadow({ mode: 'closed', delagatesFocus: true});
		this.#$$.append(swapTpl.content.cloneNode(true))

		let slot = this.#$$.querySelector('slot[name=amount]');
		this.#$.amount = slot.assignedElements()[0] ?? slot.firstElementChild;
		this.#$.from   = this.#$$.querySelector('slot[name=from-select]').assignedElements()[0];
		this.#$.to     = this.#$$.querySelector('slot[name=to-select]').assignedElements()[0];
		this.#$.output = this.#$$.querySelector('#to input');
		this.#$.outMsg = this.#$$.querySelector('#to+.message');
		this.#$.swBtn  = this.#$$.querySelector('#switch');

		if ('ElementInternals' in window && 
			'setFormValue' in window.ElementInternals.prototype) {
			this.#internals = this.attachInternals();
			this.#internals.setFormValue(this.value);
		}
	}

	connectedCallback() {
		this.#$$.addEventListener('input', this.#onInput);
		this.#$.swBtn.addEventListener('click', this.#switchPair);

		Object.assign(this.#$.amount, { min: 0.001, step: '.001', placeholder: '0.00' });
		this.amount = this.#$.amount?.value;
		this.from = this.#$.from?.value;
		this.to = this.#$.to?.value;
		// state from URL
		this.update(new URL(location).searchParams);
	}

	attributeChangedCallback(name, old, val) {
		if (name == 'rate' && old !== val) this.update({rate: val}, false);
	}

	update(state = null, canSkip = true) {
		let updates = {};
		if (state) {
			for (let [name, val] of changes(this.#state, state)) {
				if (name in this.#state) {
					this[name] = val; // setter sanitizes input
					updates[name] = this.#state[name];
				}
			}
		} else {
			updates = this.#state; // force udpate all properties
		}
		cancelAnimationFrame(this.#raf);
		let raf = requestAnimationFrame(() => this.#updateDOM(entries(updates)));
		if (canSkip) this.#raf = raf;
	}

	#updateDOM(updates) {
		for (let [name, val] of updates) switch (name) {
			case 'amount': val = val != 0 ? val: '';
			case 'from':
			case 'to':
				let input = this.#$[name];
				if (input != this.#$src) input.value = val;
				break;
			case 'rate': this.#$.outMsg.textContent = this.#outMsg; break;
		}
		if (this.#$src != this.#$.output) {
			let out = this.#output, $out = this.#$.output;
			if (out != $out.value) $out.value = out != 0 ? out: '';
		}
		this.#$src = null;
	}

	get #output() {
		let out = this.amount * this.rate;
		return out <= 0.01 ? +out.toFixed(4) : +out.toFixed(3);
	}
	get #outMsg() { return this.dataset.outMsg?.replace('{}', this.rate); }

	get pair() { return { from: this.from, to: this.to } }

	get rate() { return this.#state.rate; }
	set rate(val = 1) { this.#state.rate = +(+val).toFixed(3); }

	get amount() { return this.#state.amount; }
	set amount(val = 0) { this.#state.amount = Math.max(0, +val); }

	get from() { return this.#state.from; }
	set from(val = '') { this.#state.from = val.toUpperCase(); }

	get to() { return this.#state.to; }
	set to(val = '') { this.#state.to = val.toUpperCase(); }

	// form associated element
	get value() { return this.#$.from.name }
	get form() { return this.#internals.form; }
	get name() { return this.getAttribute('name'); }
	get type() { return this.localName; }
	get validity() { return this.#internals.validity; }
	get validationMessage() { return this.#internals.validationMessage; }
	get willValidate() { return this.#internals.willValidate; }
	checkValidity() { return this.#internals.checkValidity(); }
	reportValidity() { return this.#internals.reportValidity(); }

	toJSON() { return this.#state; }
}
customElements.define(Swap.tag, Swap);

const offerTpl = html`
<style>
:host {
	--input-rad: 1rem;

	background: var(--color-fg);
	border-radius: var(--input-rad);
	color: #32292F;
	display: grid;
	font-family: 'DM Mono', monospace;
	font-size: 0.9em;
	grid-template-columns: 2fr 2fr 3fr;
	grid-template-rows: 1fr 1fr;
	margin: 0.6rem auto;
	padding: 1rem calc(10px + 1vw);
	align-items: center;
}
::slotted(output), output {
	font-size: calc(1.2em + 0.5vw);
}

.item span { margin-left: 0.5rem; }
#price { grid-area: 1 / 3 / 3; justify-self: end; }
#relative {
	background: #6FCF971A;
	border-radius: 4px;
	color: #39885A;
	margin-left: auto;
	padding: 2px;
	width: fit-content;
}
</style>
<!-- ----- end of styles ----- -->

<div id="swaps" class="item">
	<svg width="10" height="12" viewBox="0 0 10 12">
		<path d="m2.03 0.697c1.83-0.263 3.69-0.263 5.53 0 0.703 0.101 1.24 0.671 1.31 1.38l0.0807 0.888c0.184 2.02 0.184 4.05 0 6.07l-0.0807 0.888c-0.0643 0.707-0.606 1.28-1.31 1.38-1.83 0.263-3.69 0.263-5.53 0-0.703-0.101-1.24-0.671-1.31-1.38l-0.0807-0.888c-0.184-2.02-0.184-4.05-1e-6 -6.07l0.0807-0.888c0.0643-0.707 0.606-1.28 1.31-1.38z" stroke="rgba(0,0,0,0.4)" fill="none"/>
		<path d="m5.81 7.93c-0.0874-0.0868-0.0874-0.227 0-0.314l0.215-0.213-0.976-1e-4c-0.2 0-0.383-0.114-0.47-0.292l-0.993-2.04c-0.0125-0.0256-0.0385-0.0418-0.0671-0.0418h-0.507c-0.124 0-0.224-0.0995-0.224-0.222 0-0.123 0.1-0.222 0.224-0.222h0.507c0.2 0 0.383 0.114 0.47 0.292l0.993 2.04c0.0125 0.0256 0.0385 0.0418 0.0671 0.0418l0.976 9e-5 -0.215-0.213c-0.0874-0.0868-0.0874-0.227 0-0.314 0.0874-0.0868 0.229-0.0868 0.316 0l0.597 0.593c0.0874 0.0868 0.0874 0.227 0 0.314l-0.597 0.593c-0.0874 0.0868-0.229 0.0868-0.316 0zm-1.76-0.949c0.0159-0.0326 0.0159-0.0707 0-0.103l-0.17-0.348c-0.0217-0.0446-0.0856-0.0446-0.107 0l-0.188 0.386c-0.0125 0.0256-0.0385 0.0418-0.0671 0.0418h-0.507c-0.124 0-0.224 0.0995-0.224 0.222s0.1 0.222 0.224 0.222h0.507c0.2 0 0.383-0.114 0.47-0.292zm1.76-2.92c-0.0874 0.0868-0.0874 0.227 0 0.314l0.215 0.213-0.976-9.9e-5c-0.2 0-0.383 0.114-0.47 0.292l-0.0628 0.129c-0.0159 0.0326-0.0159 0.0707 0 0.103l0.17 0.348c0.0217 0.0446 0.0856 0.0446 0.107 0l0.188-0.386c0.0125-0.0256 0.0385-0.0418 0.0671-0.0418l0.976 1e-4 -0.215 0.213c-0.0874 0.0868-0.0874 0.227 0 0.314 0.0874 0.0868 0.229 0.0868 0.316 0l0.597-0.593c0.0874-0.0868 0.0874-0.227 0-0.314l-0.597-0.593c-0.0874-0.0868-0.229-0.0868-0.316 0z" fill="rgba(0,0,0,0.4)"/>
	</svg><span></span>
</div>

<div id="name" class="item">
	<svg width="11" height="12" viewBox="0 0 11 12">
		<path d="m2.49 0.203c1.88-0.27 3.79-0.27 5.67 0 0.932 0.134 1.65 0.89 1.74 1.83l0.0807 0.888c0.187 2.05 0.187 4.11 0 6.16l-0.0807 0.888c-0.0853 0.938-0.803 1.69-1.74 1.83-1.88 0.27-3.79 0.27-5.67 0-0.932-0.134-1.65-0.89-1.74-1.83l-0.0807-0.888c-0.187-2.05-0.187-4.11-1e-6 -6.16l0.0807-0.888c0.0853-0.938 0.803-1.69 1.74-1.83zm5.53 0.944c-1.79-0.257-3.61-0.257-5.4 0-0.495 0.0711-0.876 0.472-0.921 0.97l-0.0807 0.888c-0.181 1.99-0.181 4 0 5.99l0.0807 0.888c0.0453 0.498 0.426 0.899 0.921 0.97 1.79 0.257 3.61 0.257 5.4 0 0.495-0.071 0.876-0.472 0.921-0.97l0.0807-0.888c0.181-1.99 0.181-4 0-5.99l-0.0807-0.888c-0.0453-0.498-0.426-0.899-0.921-0.97zm-3.33 5.17c-1.05 0-1.91 0.854-1.91 1.91 0 0.351 0.285 0.636 0.636 0.636h3.82c0.351 0 0.636-0.285 0.636-0.636 0-1.05-0.854-1.91-1.91-1.91zm-0.636-2.23c0-0.702 0.569-1.27 1.27-1.27 0.702 0 1.27 0.569 1.27 1.27 0 0.702-0.569 1.27-1.27 1.27-0.702 0-1.27-0.569-1.27-1.27z" fill="rgba(0,0,0,0.4)"/>
	</svg><span></span>
</div>

<div id="method" class="item">
	<svg width="11" height="12" viewBox="0 0 11 12">
		<path d="m7.89 9.07c0 0.256 0.207 0.463 0.463 0.463 0.256 0 0.463-0.207 0.463-0.463v-3.7c0-0.256-0.207-0.463-0.463-0.463-0.256 0-0.463 0.207-0.463 0.463zm-2.62 0.463c-0.256 0-0.463-0.207-0.463-0.463v-3.7c0-0.256 0.207-0.463 0.463-0.463 0.256 0 0.463 0.207 0.463 0.463v3.7c0 0.256-0.207 0.463-0.463 0.463zm-3.55-0.463c0 0.256 0.207 0.463 0.463 0.463s0.463-0.207 0.463-0.463v-3.7c0-0.256-0.207-0.463-0.463-0.463s-0.463 0.207-0.463 0.463zm-1.23 2.47c0-0.256 0.207-0.463 0.463-0.463h8.64c0.256 0 0.463 0.207 0.463 0.463 0 0.256-0.207 0.463-0.463 0.463h-8.64c-0.256 0-0.463-0.207-0.463-0.463zm4.42-11.5c0.235-0.0723 0.487-0.0723 0.722 0l1.84 0.566c0.961 0.295 1.87 0.73 2.71 1.29 0.65 0.435 0.342 1.45-0.44 1.45h-8.95c-0.782 0-1.09-1.01-0.44-1.45 0.836-0.56 1.75-0.994 2.71-1.29zm0.45 0.885c-0.058-0.0178-0.12-0.0178-0.178 0l-1.84 0.566c-0.729 0.224-1.43 0.536-2.08 0.928h8.02c-0.653-0.392-1.35-0.704-2.08-0.928z" fill="rgba(0,0,0,0.4)"/>
	</svg><span></span>
</div>

<div id="where" class="item">
	<svg width="11" height="12" viewBox="0 0 11 12">
		<path d="m0.55 4.42c0.206-2.5 2.29-4.42 4.8-4.42h0.251c2.5 0 4.59 1.92 4.8 4.42 0.111 1.34-0.304 2.67-1.16 3.71l-2.78 3.4c-0.508 0.621-1.46 0.621-1.97 0l-2.78-3.4c-0.852-1.04-1.27-2.37-1.16-3.71zm4.8-3.55c-2.05 0-3.76 1.57-3.93 3.62-0.092 1.12 0.253 2.22 0.961 3.09l2.78 3.4c0.16 0.195 0.458 0.195 0.618 0l2.78-3.4c0.709-0.867 1.05-1.97 0.961-3.09-0.168-2.04-1.88-3.62-3.93-3.62zm-2.63 4.21c0-1.52 1.23-2.76 2.76-2.76 1.52 0 2.76 1.23 2.76 2.76s-1.23 2.76-2.76 2.76c-1.52 0-2.76-1.23-2.76-2.76zm2.76-1.89c-1.04 0-1.89 0.845-1.89 1.89s0.845 1.89 1.89 1.89 1.89-0.845 1.89-1.89-0.845-1.89-1.89-1.89z" fill="rgba(0,0,0,0.4)"/>
	</svg><span></span>
</div>

<div id="price">
	<slot><output></output></slot>
	<div id="relative"><span></span></div>
</div>
`;

export class SwapOffer extends HTMLElement {
	static tag = 'swap-offer';
	static #fields = ['swaps', 'name', 'where', 'method', 'relative', 'price'];

	#$ = {};

	constructor() {
		super();
		let $ = this.attachShadow({ mode: 'closed', delagatesFocus: true});
		$.append(offerTpl.content.cloneNode(true))
		for (let it of SwapOffer.#fields)
			this.#$[it] = $.querySelector(`#${it} span`);
	}

	connectedCallback() {
		this.#updateFields();
	}

	#updateFields() {
		for (let [name, val] of Object.entries(this.dataset)) {
			if (SwapOffer.#fields.includes(name)) {
				this.#$[name].textContent = val;
			} else {
				delete this.dataset[name];
			}
		}
	}
}
customElements.define(SwapOffer.tag, SwapOffer);
