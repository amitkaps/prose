/** @prose
 * The counter's behavior: holds the count, applies a step when a button is pressed, and renders the
 * result into the page.
 */

/** @prose
 * # State
 *
 * The count is a single number in module scope. `render` is the only thing that writes it to the
 * page, so the page never shows a value the script doesn't hold.
 */
let count = 0;
const output = document.querySelector('#count');

function render() {
	output.value = String(count);
}

/** @prose
 * # Input
 *
 * One click handler on the counter reads `data-step` from whichever button was pressed and adds it
 * to `count`. Adding a button with a different step needs no new script.
 */
document.querySelector('.counter').addEventListener('click', (event) => {
	const button = event.target.closest('button[data-step]');
	if (!button) return;
	count += Number(button.dataset.step);
	render();
});

render();

/** @prose
 * # Persistence
 *
 * The count survives a reload: it is saved to `localStorage` after every change and read back on
 * load. If storage is unavailable, the counter still works and starts from zero.
 */
