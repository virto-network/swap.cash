export function _create(cfg) {
	console.log('creating swap plugin')
}

export function getOffers(msg) {
	console.log('received message in swap plugin', msg);
	return ['first', 'second', 'third']
}
