const p = new DOMParser();
const html = (ss, ...parts) => p.parseFromString('<template>' + parts
	.reduce((t, val, i) => `${t}${strings[i]}${val}`, '')
	.concat(ss[parts.length])
+ '</template>', 'text/html').querySelector('template');

const template = html`
<style>
:host {
	--sw-size: 20px;
	--input-rad: 1rem;

	display: flex; flex-direction: column;
	grid-template-rows: repeat(1fr 3);
	position: relative;
}

.field {
	flex: 1;
	display: flex; flex-direction: column;
	background: white;
	border-radius: var(--input-rad);
	box-sizing: border-box;
	padding: 0.8rem 1rem 0.5rem;
	margin: 3px 0;
}
.field>div { display: flex; }

#to, #from { flex: 3; }
.message { flex: 2; }

#switch {
	position: absolute;
	height: var(--sw-size); width: var(--sw-size);
	top: 50%; left: 50%;
	margin-top: calc((-1*var(--sw-size) / 2) - 6px);
	margin-left: calc((-1*var(--sw-size) / 2) - 6px);
	border: none;
	padding: 0;
	background: var(--color-alt2);
	border: 6px solid var(--color-bg);
	border-radius: 12px;
	box-sizing: content-box;
	display: flex; align-items: center; justify-content: center;
}
#switch svg { width: 50%; }

::slotted(input), input {
	all: initial;
	-moz-appearance: textfield;
	color: var(--color-alt2);
	flex: 1;
	font-family: 'Major Mono Display', monospace;
	font-size: calc(1.1em + 1vw);
	font-weight: bold;
	margin-right: 5px;
	min-width: 0;
}
::slotted(select), select {
	background: var(--color-bg);
	border-radius: 5px;
	border: none;
	box-sizing: border-box;
	color: var(--color-alt2);
	padding: .3rem 0 .3rem .5rem;
}
</style>
<!-- ----- end of styles ----- -->

<div class="field">
	<div id="from">
		<slot name="amount">
			<input type="number" placeholder="0.00" min="0" step=".01" required />
		</slot>
		<slot name="fiat-select">
			<select><option disabled selected>---</option></select>
		</slot>
	</div>
	<div class="message"></div>
</div>
<div class="field">
	<div id="to">
		<input type="number" placeholder="0.00" min="0" step=".01" required />
		<slot name="crypto-select">
			<select><option disabled selected>---</option></select>
		</slot>
	</div>
	<div class="message"></div>
</div>

<button id="switch">
	<svg width="8" height="8" fill="var(--color-accent)" viewBox="0 0 8 8">
		<path d="m0.197 4.47c1.11 1.11 2.22 2.22 3.33 3.33 0.174 0.168 0.441 0.235 0.672 0.16 0.117-0.0357 0.223-0.102 0.306-0.192 1.1-1.1 2.2-2.21 3.31-3.31 0.165-0.166 0.23-0.422 0.166-0.647-0.0603-0.225-0.248-0.411-0.474-0.468-0.223-0.061-0.474 0.00523-0.638 0.168-0.733 0.735-1.47 1.47-2.2 2.21-3.42e-5 -1.69 6.85e-5 -3.38-5.14e-5 -5.07-7.95e-4 -0.233-0.135-0.459-0.338-0.572-0.201-0.116-0.463-0.115-0.663 0.00405-0.202 0.115-0.333 0.343-0.331 0.576v5.06c-0.735-0.737-1.47-1.48-2.2-2.21-0.165-0.162-0.418-0.225-0.64-0.161-0.245 0.0659-0.441 0.282-0.482 0.532-0.0382 0.212 0.0337 0.438 0.187 0.588z"/>
	</svg>
</button>
`

export class SwapCash extends HTMLElement {
	static tag = 'swap-cash';

	#$amount;
	#amount = 0;
	#rate = 1;

	#onInput = ({target}) => {
		console.log(target)
	};

	constructor() {
		super();
		let $ = this.attachShadow({ mode: 'closed', delagatesFocus: true});
		$.append(template.content.cloneNode(true))

		this.#$amount = $.querySelector('slot[name=amount]').assignedElements().at(0);
	}

	connectedCallback() {
		Object.assign(this.#$amount || {}, { min: 0, placeholder: '0.00' });
	}
}
customElements.define(SwapCash.tag, SwapCash);
