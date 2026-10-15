"""Presentation-only scene rendering of the exact existing showcase episodes.

No physics steps, policy execution, dataset edits, or simulator source edits.
The original image variant is never modified. Original video sampling is matched
against restored baseline frames before the selected background is installed.
"""
import argparse
import hashlib
import json
import pickle
import sys
from pathlib import Path

import imageio.v2 as imageio
import numpy as np
from PIL import Image

SITE = Path(__file__).resolve().parents[1]
PROJECT = SITE.parent / "SoftHandGrasping"
sys.path.insert(0, str(PROJECT))
from data_gen.teleop import replay_recording as replay
from data_gen.teleop.recorder import _capture_frame
from data_gen.teleop.camera import apply_operator_view
from data_gen.teleop.episode_store import restore_seed
from mani_skill.utils import sapien_utils
from mani_skill.utils.registration import REGISTERED_ENVS
from utils.dex_scene_eval import install_eval_background
import utils.dex_scene_eval as scene_eval
from utils.dex_scene_checks import inspect_native_scene

DESIGN = {
    "meal-preparation": ("robocasa_l3_s1", [-1.10, -.28, .95], [-.05, -.04, .08], .85),
    "cabinet-pour": ("robocasa_l3_s6", [-1.15, -.25, 1.12], [.18, .0, .26], .88),
    "drawer-plug": ("robocasa_l3_s2", [-1.08, -.24, 1.10], [.185, .18, .23], .88),
    "nut-bolt": ("robocasa_l3_s0", [-.9, .42, .82], [-.04, .0, .08], .78),
    "office-desk": ("robocasa_l3_s3", [-1.1, .15, 1.1], [-.07, .0, .15], .85),
    "furniture-assembly": ("robocasa_l3_s8", [-.96, .72, 1.15], [-.13, -.06, .10], .85),
    "pipette-transfer": ("robocasa_l3_s4", [-.9, .40, .9], [-.04, .0, .17], .83),
    "juice-preparation": ("robocasa_l3_s7", [-1.1, .64, 1.15], [.12, -.05, .20], .95),
    "package-opening": ("robocasa_l3_s5", [-1.15, .0, 1.10], [-.12, .0, .12], .94),
    "table-cleaning": ("robocasa_l3_s9", [-1.1, .62, 1.05], [.08, -.05, .10], .94),
}

def install_presentation_styles():
    """Expose existing authored finishes only in this renderer process.

    No task, dataset, shared library or benchmark scene matrix is modified.
    Native support height and edge alignment are still checked after reset.
    """
    from task.scene_builders.scene_library import SceneSpec
    from mani_skill.utils.scene_builder.robocasa.utils.scene_registry import StyleType
    known = {s.scene_id for s in scene_eval.AVAILABLE_BACKGROUNDS}
    extras = tuple(scene_eval.BackgroundSpec(f"robocasa_l3_s{style}",
        "Presentation: " + StyleType(style).name.replace("_", " ").title(),
        scene_eval.BACKGROUNDS[0].anchor)
        for style in range(10) if f"robocasa_l3_s{style}" not in known)
    scene_eval.OPTIONAL_BACKGROUNDS += extras
    original = scene_eval._scene_spec
    def resolve_scene(scene_id):
        if scene_id.startswith("robocasa_l3_s"):
            return SceneSpec(scene_id, "robocasa", 36 + int(scene_id.rsplit("s", 1)[1]))
        return original(scene_id)
    scene_eval._scene_spec = resolve_scene

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def rgb8(value):
    if hasattr(value, "detach"):
        value = value.detach().cpu().numpy()
    value = np.asarray(value)
    if value.ndim == 4:
        value = value[0]
    value = value[..., :3]
    if value.dtype != np.uint8:
        value = np.clip(value * (255 if value.max() <= 1.001 else 1), 0, 255).astype(np.uint8)
    return value

def thumbnail(rgb):
    return np.asarray(Image.fromarray(rgb8(rgb)).resize((96, 54), Image.Resampling.BILINEAR), dtype=np.float32)

def restore_error(expected, actual):
    errors = []
    for key, value in expected.items():
        if isinstance(value, dict):
            errors.append(restore_error(value, actual[key]))
        else:
            if hasattr(value, "detach"):
                value = value.detach().cpu().numpy()
            a, b = np.asarray(value), np.asarray(actual[key])
            errors.append(float(np.max(np.abs(a-b))) if a.size else 0.)
    return max(errors, default=0.)

def match_frames(baseline, original):
    """Match wall-clock review-video samples to monotonically ordered raw states."""
    a, b = np.asarray(original), np.asarray(baseline)
    # Motion pixels help disambiguate similar frames without static-room bias.
    mask = np.maximum(a.var(axis=0).mean(axis=2), b.var(axis=0).mean(axis=2)) > 8
    assert mask.sum() > 10, "No visible task motion to match"
    av, bv = a[:, mask].reshape(len(a), -1), b[:, mask].reshape(len(b), -1)
    cost = np.maximum((av**2).mean(1)[:, None] + (bv**2).mean(1)[None, :] - 2 * (av @ bv.T) / av.shape[1], 0.)
    m, n = cost.shape
    assert m <= n, (m, n)
    dp = np.full((m, n), np.inf)
    previous = np.full((m, n), -1, dtype=int)
    dp[0, 0] = cost[0, 0]
    gap_max = max(12, int(np.ceil(n / m * 5)))
    for j in range(1, m):
        for gap in range(1, gap_max + 1):
            candidate = dp[j-1, :-gap] + .01 * (gap - n/m)**2
            wins = candidate < dp[j, gap:]
            dp[j, gap:][wins] = candidate[wins]
            previous[j, gap:][wins] = np.arange(n-gap)[wins]
        dp[j] += cost[j]
    index = int(np.argmin(dp[-1]))
    indices = [index]
    for j in range(m-1, 0, -1):
        index = int(previous[j, index])
        assert index >= 0, "No monotonic source-frame correspondence"
        indices.append(index)
    indices.reverse()
    mae = np.abs(a - b[indices]).mean(axis=(1, 2, 3))
    return indices, {"mean_rgb_mae": float(mae.mean()), "max_rgb_mae": float(mae.max()),
        "motion_pixels": int(mask.sum()), "source_video_frames": m, "raw_frames": n}

def make_env(meta, background=None):
    identity = dict(meta["identity_manifest"])
    replay.load_task_module(identity["task"])
    if background:
        install_eval_background(identity["env_id"], background)
    kwargs = json.loads(identity["env_kwargs"])
    kwargs.update(sim_backend="physx_cpu", human_render_camera_configs={"width": 640, "height": 360})
    identity["env_kwargs"] = json.dumps(kwargs)
    env = replay._make_env(identity)
    env.reset(seed=restore_seed({"meta": meta}))
    if background is None:
        apply_operator_view(env)
    return env

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("task", choices=DESIGN)
    p.add_argument("--out", type=Path, required=True)
    p.add_argument("--preview", action="store_true")
    p.add_argument("--diagnose", action="store_true")
    args = p.parse_args()
    install_presentation_styles()
    args.out.mkdir(parents=True, exist_ok=True)
    record = next(r for r in json.loads((SITE / "src/task-preview-videos.json").read_text()) if r["task"] == args.task)
    episode = (SITE.parent / record["source"]).parent
    meta = json.loads((episode / "meta.json").read_text())
    assert meta["final_success"] and sha(episode / "episode.npz") == record["episode_sha256"]
    raw_hash = sha(episode / "raw_states.pkl")
    with (episode / "raw_states.pkl").open("rb") as f:
        states = pickle.load(f)
    reader = imageio.get_reader(str(episode / "video.mp4"))
    fps = float(reader.get_meta_data()["fps"])
    original = [thumbnail(frame) for frame in reader]
    reader.close()
    identity = meta["identity_manifest"]
    replay.load_task_module(identity["task"])
    original_cls = REGISTERED_ENVS[identity["env_id"]].cls
    env = writer = None
    try:
        if not args.preview:
            env = make_env(meta)
            baseline = []
            for index, state in enumerate(states):
                replay._set_raw_state(env, state)
                frame = _capture_frame(env)
                assert frame is not None
                baseline.append(thumbnail(frame))
                if index == 0:
                    Image.fromarray(frame).save(args.out / "baseline-first.png")
                    Image.fromarray(original[0].astype(np.uint8)).save(args.out / "source-first.png")
                    if args.diagnose:
                        print(json.dumps({"task": args.task, "first_rgb_mae": float(np.abs(baseline[0] - original[0]).mean()), "source_frames": len(original), "raw_frames": len(states)}), flush=True)
                        return
                if index % 50 == 0:
                    print(json.dumps({"task": args.task, "phase": "match-original-timing", "frame": index, "total": len(states)}), flush=True)
            env.close(); env = None
            indices, alignment = match_frames(baseline, original)
            assert alignment["max_rgb_mae"] < 12, ("Original-video correspondence failed", alignment)
        else:
            indices = sorted({0, len(states)//2, len(states)-1})
            alignment = None
        scene, eye, target, fov = DESIGN[args.task]
        env = make_env(meta, scene)
        u = env.unwrapped
        camera = u.scene.sub_scenes[0].add_camera("showcase", 960, 720, fov, .01, 100)
        camera.set_local_pose(sapien_utils.look_at(eye, target).sp)
        for obj in getattr(u, "_hidden_objects", []):
            obj.show_visual()
        if not args.preview:
            writer = imageio.get_writer(str(args.out / (args.task + ".mp4")), fps=fps, codec="libx264", quality=None,
                macro_block_size=1, ffmpeg_params=["-preset", "fast", "-crf", "23", "-pix_fmt", "yuv420p", "-movflags", "+faststart"])
        errors, checks = [], []
        for output_index, index in enumerate(indices):
            replay._set_raw_state(env, states[index])
            error = restore_error(states[index], replay._current_raw_state(env))
            assert error < 1e-6, (index, error)
            errors.append(error)
            if output_index in {0, len(indices)//2, len(indices)-1}:
                check = inspect_native_scene(env)
                assert not check["errors"], check["errors"]
                checks.append({"raw_frame": index, "height_error_m": check["tabletop_height_error_m"], "robot_clearance_m": check["robot_table_clearance"]["minimum_separation_m"]})
            u.scene.update_render()
            camera.take_picture()
            frame = rgb8(camera.get_picture("Color"))
            assert frame.std() > 2
            if writer:
                writer.append_data(frame)
            if output_index in {0, len(indices)//2, len(indices)-1}:
                Image.fromarray(frame).save(args.out / f"scene-frame-{index}.png")
            if output_index % 40 == 0:
                print(json.dumps({"task": args.task, "phase": "render-scene", "frame": output_index, "total": len(indices)}), flush=True)
        if writer:
            writer.close(); writer = None
        assert sha(episode / "raw_states.pkl") == raw_hash
        manifest = {"task": args.task, "scene_id": scene, "source": record["source"], "env_id": record["env_id"],
            "episode_sha256": record["episode_sha256"], "raw_state_sha256": raw_hash,
            "fps": fps, "rendered_frames": len(indices), "duration_seconds": len(indices)/fps,
            "matched_raw_frame_indices": indices, "alignment": alignment,
            "physics_steps": 0, "max_restore_error": max(errors), "frames_checked": len(errors),
            "camera": {"eye": eye, "target": target, "fov": fov, "resolution": [960, 720]},
            "native_scene_checks": checks, "background": u.eval_background_manifest,
            "usage": "Presentation-only state restoration in a different scene; not new policy or action-replay evaluation."}
        if not args.preview:
            manifest["output_sha256"] = sha(args.out / (args.task + ".mp4"))
        (args.out / ("preview.json" if args.preview else "render.json")).write_text(json.dumps(manifest, indent=2) + "\n")
        print(json.dumps({"task": args.task, "complete": True, "preview": args.preview}), flush=True)
    finally:
        if writer:
            writer.close()
        if env:
            env.close()
        REGISTERED_ENVS[identity["env_id"]].cls = original_cls

if __name__ == "__main__":
    main()
