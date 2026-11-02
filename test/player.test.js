import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ARCHIPELAGO } from '../src/archipelago/index.js';
import { Player } from '../src/player.js';
import { Replay } from '../src/replay.js';

// Stands in for the real animation, so a test decides exactly when each one finishes.
function setup({ immediate = false } = {}) {
  const replay = new Replay(ARCHIPELAGO);
  replay.load();
  const log = { started: [], cancelled: [], renders: [] };
  let finishCurrent = null;

  const animate = (event, done) => {
    log.started.push(event.seq);
    if (immediate) {
      done();
      return () => { throw new Error('nothing to cancel'); };
    }
    finishCurrent = () => {
      finishCurrent = null;
      done();
    };
    return () => {
      log.cancelled.push(event.seq);
      finishCurrent = null;
    };
  };
  const render = () => log.renders.push(replay.view().position);
  const player = new Player(replay, { animate, render });
  return { replay, player, log, finish: () => finishCurrent?.(), isAnimating: () => finishCurrent !== null };
}

const completeRun = () => {
  const replay = new Replay(ARCHIPELAGO);
  replay.load();
  replay.runToEnd();
  return replay.view();
};

const startView = () => {
  const replay = new Replay(ARCHIPELAGO);
  replay.load();
  return replay.view();
};

test('Step plays one event, and the screen only redraws when its animation finishes', () => {
  const { player, log, finish, replay } = setup();
  player.step();
  assert.deepEqual(log.started, [0]);
  assert.deepEqual(log.renders, []);
  assert.equal(replay.view().position, 0);

  finish();
  assert.deepEqual(log.renders, [0]);
});

test('pressing Step mid-animation completes that event and starts the next, so no press is lost', () => {
  const { player, log, finish, replay } = setup();
  player.step();
  player.step();
  player.step();
  assert.deepEqual(log.started, [0, 1, 2]);
  assert.deepEqual(log.cancelled, [0, 1]);
  assert.deepEqual(log.renders, [0, 1]);
  assert.equal(replay.view().position, 2);

  finish();
  assert.deepEqual(log.renders, [0, 1, 2]);
});

test('rapid Step presses through every event end in the same state as a complete run', () => {
  const { player, finish, replay } = setup();
  for (let i = 0; i < 56; i++) player.step();
  finish();
  assert.deepEqual(replay.view(), completeRun());
});

test('Step at the end only finishes the current animation', () => {
  const { player, log, finish, replay } = setup();
  replay.runToEnd();
  player.step();
  assert.deepEqual(log.started, []);
  finish();
  assert.deepEqual(log.renders, []);
});

test('Run to End plays every event in order and then stops', () => {
  const { player, log, finish, replay } = setup();
  player.runToEnd();
  assert.equal(player.isPlaying, true);

  for (let i = 0; i < 56; i++) {
    assert.equal(replay.view().position, i);
    finish();
  }
  assert.equal(player.isPlaying, false);
  assert.deepEqual(log.started, Array.from({ length: 56 }, (_, i) => i));
  assert.equal(log.renders.at(-1), 55);
  assert.deepEqual(replay.view(), completeRun());
});

test('Step is ignored while Run to End is playing', () => {
  const { player, log } = setup();
  player.runToEnd();
  player.step();
  player.step();
  assert.deepEqual(log.started, [0]);
  assert.deepEqual(log.cancelled, []);
});

test('pressing Run to End again skips to the final state, with nothing left playing', () => {
  const { player, log, finish, replay, isAnimating } = setup();
  player.runToEnd();
  finish();
  finish();
  player.runToEnd();

  assert.equal(player.isPlaying, false);
  assert.equal(isAnimating(), false);
  assert.deepEqual(log.cancelled, [2]);
  assert.equal(log.renders.at(-1), 55);
  assert.deepEqual(replay.view(), completeRun());

  const started = log.started.length;
  finish();
  assert.equal(log.started.length, started);
});

test('Run to End during a stepped animation continues from the next event without repeating any', () => {
  const { player, log, finish, replay } = setup();
  player.step();
  player.runToEnd();
  assert.deepEqual(log.cancelled, [0]);
  assert.deepEqual(log.started, [0, 1]);
  while (player.isPlaying) finish();
  assert.deepEqual(replay.view(), completeRun());
});

test('Reset mid-animation cancels it and restores the pre-traversal state', () => {
  const { player, log, finish, replay, isAnimating } = setup();
  player.step();
  player.reset();
  assert.deepEqual(log.cancelled, [0]);
  assert.equal(isAnimating(), false);
  assert.deepEqual(replay.view(), startView());

  finish();
  assert.deepEqual(log.renders, [-1]);
});

test('Reset while Run to End is playing stops it', () => {
  const { player, log, replay, isAnimating } = setup();
  player.runToEnd();
  player.reset();
  assert.equal(player.isPlaying, false);
  assert.equal(isAnimating(), false);
  assert.deepEqual(log.cancelled, [0]);
  assert.deepEqual(replay.view(), startView());
});

test('Load while Run to End is playing stops it and shows the pre-traversal state', () => {
  const { player, replay, isAnimating } = setup();
  player.runToEnd();
  player.load();
  assert.equal(player.isPlaying, false);
  assert.equal(isAnimating(), false);
  assert.deepEqual(replay.view(), startView());
});

test('with reduced motion, each animation finishes immediately and the states are unchanged', () => {
  const stepped = setup({ immediate: true });
  for (let i = 0; i < 56; i++) stepped.player.step();
  assert.deepEqual(stepped.replay.view(), completeRun());
  assert.deepEqual(stepped.log.renders, Array.from({ length: 56 }, (_, i) => i));
  assert.deepEqual(stepped.log.cancelled, []);

  const played = setup({ immediate: true });
  played.player.runToEnd();
  assert.equal(played.player.isPlaying, false);
  assert.deepEqual(played.replay.view(), completeRun());

  played.player.reset();
  assert.deepEqual(played.replay.view(), startView());
});

test('repeated animated runs give an identical final view', () => {
  const { player, finish, replay } = setup();
  const expected = completeRun();
  for (let round = 0; round < 3; round++) {
    player.runToEnd();
    while (player.isPlaying) finish();
    assert.deepEqual(replay.view(), expected);
    player.reset();
  }
});
