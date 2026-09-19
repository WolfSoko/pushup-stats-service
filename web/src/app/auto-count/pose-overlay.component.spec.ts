import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { POSE_LANDMARK, type PoseSkeleton } from '@pu-stats/auto-count';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PoseOverlayComponent } from './pose-overlay.component';

const TRIPLET = [
  POSE_LANDMARK.LEFT_SHOULDER,
  POSE_LANDMARK.LEFT_ELBOW,
  POSE_LANDMARK.LEFT_WRIST,
] as const;

const SKELETON: PoseSkeleton = {
  landmarks: Array.from({ length: 33 }, (_, i) => {
    if (i === POSE_LANDMARK.LEFT_SHOULDER)
      return { x: 0.4, y: 0.2, visibility: 0.9 };
    if (i === POSE_LANDMARK.LEFT_ELBOW)
      return { x: 0.4, y: 0.5, visibility: 0.9 };
    if (i === POSE_LANDMARK.LEFT_WRIST)
      return { x: 0.7, y: 0.5, visibility: 0.9 };
    return { x: 0, y: 0, visibility: 0 };
  }),
  triplet: TRIPLET,
};

const makeContext = () => ({
  clearRect: vi.fn(),
  setTransform: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  arc: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  strokeText: vi.fn(),
  fillText: vi.fn(),
  strokeStyle: '',
  fillStyle: '',
  lineWidth: 0,
  lineCap: '',
  lineJoin: '',
  font: '',
  textAlign: '',
  textBaseline: '',
});

const makeVideo = (width: number, height: number): HTMLVideoElement =>
  ({ videoWidth: width, videoHeight: height }) as HTMLVideoElement;

describe('PoseOverlayComponent', () => {
  let ctx: ReturnType<typeof makeContext>;

  const render = (
    inputs: {
      video?: HTMLVideoElement | null;
      skeleton?: PoseSkeleton | null;
      angleDeg?: number | null;
    },
    stage = { width: 300, height: 400 }
  ) => {
    const fixture = TestBed.createComponent(PoseOverlayComponent);
    const canvas: HTMLCanvasElement =
      fixture.nativeElement.querySelector('canvas');
    // jsdom lays nothing out, so the element's own box has to be faked —
    // the component sizes the backing store from it.
    Object.defineProperty(canvas, 'clientWidth', { value: stage.width });
    Object.defineProperty(canvas, 'clientHeight', { value: stage.height });
    fixture.componentRef.setInput('video', inputs.video ?? null);
    fixture.componentRef.setInput('skeleton', inputs.skeleton ?? null);
    fixture.componentRef.setInput('angleDeg', inputs.angleDeg ?? null);
    fixture.detectChanges();
    return { fixture, canvas };
  };

  beforeEach(() => {
    ctx = makeContext();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D
    );
    TestBed.configureTestingModule({
      imports: [PoseOverlayComponent],
      providers: [{ provide: PLATFORM_ID, useValue: 'browser' }],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('given a skeleton and a live video, when rendered, then the pose is drawn onto the canvas', () => {
    // given / when
    render({ video: makeVideo(640, 480), skeleton: SKELETON, angleDeg: 90 });

    // then
    expect(ctx.clearRect).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalledWith(
      '90°',
      expect.any(Number),
      expect.any(Number)
    );
  });

  it('given the stage size, when rendered, then the backing store matches it in device pixels', () => {
    // given
    vi.spyOn(globalThis, 'devicePixelRatio', 'get').mockReturnValue(2);

    // when
    const { canvas } = render(
      { video: makeVideo(640, 480), skeleton: SKELETON },
      { width: 300, height: 400 }
    );

    // then
    expect(canvas.width).toBe(600);
    expect(canvas.height).toBe(800);
    expect(ctx.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
  });

  it('given no skeleton for this frame, when rendered, then the canvas is cleared and nothing is drawn', () => {
    // given / when
    render({ video: makeVideo(640, 480), skeleton: null });

    // then
    expect(ctx.clearRect).toHaveBeenCalled();
    expect(ctx.stroke).not.toHaveBeenCalled();
  });

  it('given a video whose metadata has not loaded, when rendered, then nothing is drawn', () => {
    // given / when
    render({ video: makeVideo(0, 0), skeleton: SKELETON });

    // then
    expect(ctx.stroke).not.toHaveBeenCalled();
  });

  it('given the server platform, when rendered, then the canvas is never touched', () => {
    // given
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [PoseOverlayComponent],
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    });

    // when
    render({ video: makeVideo(640, 480), skeleton: SKELETON });

    // then
    expect(ctx.clearRect).not.toHaveBeenCalled();
  });
});
