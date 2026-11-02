// Decides when the replay moves and when the screen redraws. The animation itself is passed in, so this has no browser code.
//
// animate(event, done) plays one event and returns a function that cancels it. The screen only redraws when
// an animation finishes, so each change follows the movement that caused it.
export class Player {
  #replay;
  #animate;
  #render;
  #cancelAnimation = null;
  #playing = false;

  constructor(replay, { animate, render }) {
    this.#replay = replay;
    this.#animate = animate;
    this.#render = render;
  }

  get isPlaying() {
    return this.#playing;
  }

  #stopAnimation() {
    this.#cancelAnimation?.();
    this.#cancelAnimation = null;
  }

  #play(event, onFinished) {
    let finished = false;
    const cancel = this.#animate(event, () => {
      finished = true;
      this.#cancelAnimation = null;
      this.#render();
      onFinished();
    });
    // With reduced motion the animation finishes immediately, before there is anything to cancel.
    if (!finished) this.#cancelAnimation = cancel;
  }

  // Pressing Step mid-animation completes that event instantly and starts the next, so no press is lost.
  step() {
    if (this.#playing) return;
    if (this.#cancelAnimation) {
      this.#stopAnimation();
      this.#render();
    }
    const event = this.#replay.step();
    if (event) this.#play(event, () => {});
  }

  #playNext() {
    const event = this.#replay.step();
    if (!event) {
      this.#playing = false;
      this.#render();
      return;
    }
    this.#play(event, () => this.#playNext());
  }

  // Plays every remaining event in order. Pressing it again while playing skips to the final state.
  runToEnd() {
    this.#stopAnimation();
    if (this.#playing) {
      this.#playing = false;
      this.#replay.runToEnd();
      this.#render();
      return;
    }
    this.#render();
    this.#playing = true;
    this.#playNext();
  }

  reset() {
    this.#stopAnimation();
    this.#playing = false;
    this.#replay.reset();
    this.#render();
  }

  load() {
    this.#stopAnimation();
    this.#playing = false;
    this.#replay.load();
    this.#render();
  }
}
