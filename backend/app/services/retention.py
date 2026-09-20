"""C4: Retention Mechanics.

- Zeigarnik Hook (logout interception)
- Endowed Progress (courses start at 15%)
- Scheduled Surprises (random agent takeovers)
- Emotion Check-In
- Affirmation Bank
- Break Reminder (15-minute)
"""
import random
from datetime import datetime, timedelta

INITIAL_PROGRESS = 15  # endowed progress percentage


def zeigarnik_hook(questions_answered, total, threshold=2):
    """If the student is within 'threshold' questions of finishing, produce a hook."""
    remaining = total - questions_answered
    if 0 < remaining <= threshold:
        return {
            "active": True,
            "message": f"You are {remaining} question(s) away from finishing! Finish now to bank your XP.",
            "remaining": remaining,
        }
    return {"active": False, "message": "", "remaining": remaining}


# ------------------------- Endowed Progress -------------------------

def endowed_progress(vark=None):
    """Courses start at 15% completion; bonus if their dominant style is active."""
    base = INITIAL_PROGRESS
    if vark:
        dom = max(vark, key=vark.get)
        base += 5 if dom in ("reading", "visual") else 3
    return min(30, base)


# ------------------------- Scheduled Surprises -------------------------

SURPRISES = [
    "Double XP! 🚀 Your next correct answer earns double points.",
    "New TTS voice unlocked! 🎙️ Listen to this lesson with a new voice.",
    "Cultural swap! 🌍 Explore the same topic from a different culture.",
    "Mystery badge! 🎖️ Finish this section to reveal a surprise badge.",
    "Power-up: +50 XP streak bonus if you answer correctly now! ⚡",
]


def maybe_surprise(twin, force=False):
    """Return a surprise event with some probability, or None."""
    if twin.get("surprise_triggered") and not force:
        return None
    if force or random.random() < 0.3:
        twin["surprise_triggered"] = True
        return {
            "title": "Scheduled Surprise!",
            "message": random.choice(SURPRISES),
            "kind": random.choice(["xp", "tts", "cultural", "badge", "streak"]),
        }
    return None


# ------------------------- Emotion Check-In -------------------------

MOOD_ADAPT = {
    "happy": {"tone": "energetic", "difficulty_bonus": 0.1},
    "neutral": {"tone": "steady", "difficulty_bonus": 0.0},
    "tired": {"tone": "gentle", "difficulty_bonus": -0.15},
    "frustrated": {"tone": "encouraging", "difficulty_bonus": -0.2},
    "bored": {"tone": "playful", "difficulty_bonus": 0.1},
    "excited": {"tone": "fun", "difficulty_bonus": 0.2},
}


def emotion_checkin(twin, emotion, note=""):
    twin["emotion"] = {"mood": emotion, "note": note, "ts": datetime.utcnow().isoformat() + "Z"}
    adapt = MOOD_ADAPT.get(emotion, MOOD_ADAPT["neutral"])
    return {"received": True, "mood": emotion, "adaptation": adapt}


def emotion_adaptation(twin):
    emo = twin.get("emotion")
    if not emo:
        return MOOD_ADAPT["neutral"]
    return MOOD_ADAPT.get(emo.get("mood"), MOOD_ADAPT["neutral"])


# ------------------------- Affirmation Bank -------------------------

def generate_affirmation(twin, progress_pct=0, language="en"):
    xp = twin.get("xp", 0)
    badge = twin.get("badge", "Bronze")
    sen = twin.get("sen_flags", [])
    arr = []

    base_en = [
        f"You're doing amazing work! You've earned {xp} XP.",
        f"Every question you answer makes you stronger. Keep going!",
        f"Your dedication is inspiring. Great effort today!",
    ]
    base_ar = [
        f"عمل رائع! لقد جمعت {xp} نقطة خبرة.",
        f"كل سؤال تجاوبه يجعلك أقوى. استمر!",
        f"اجتهادك ملهم. مجهود رائع اليوم!",
    ]

    if stress_sen(sen, "blind"):
        extra_en = "Your ability to learn through listening is a superpower. 🌟"
        extra_ar = "قدرتك على التعلم بالاستماع هي قوة خارقة. 🌟"
        arr.append(extra_ar if language == "ar" else extra_en)
    if stress_sen(sen, "deaf"):
        extra_en = "Your visual learning is incredibly sharp. Keep exploring with your eyes! 👀"
        extra_ar = "تعلمك البصري حاد جداً. استكمل الاكتشاف بعينيك! 👀"
        arr.append(extra_ar if language == "ar" else extra_en)

    if progress_pct >= 60:
        arr.append("Less than 40% to go — you're in the home stretch!" if language != "ar"
                   else "أقل من 40% متبقية — أنت في النهاية!")
    if badge != "Bronze":
        arr.append(f"As a {badge} learner, you set the standard!" if language != "ar"
                   else f"كمتعلم {badge}، أنت قدوة!")

    pool = base_ar if language == "ar" else base_en
    arr.extend(pool)
    twin["affirmations"] = arr
    return arr


def stress_sen(flags, key):
    # simple substring match on flags
    for f in flags:
        if key in str(f).lower():
            return True
    return False


# ------------------------- Break Reminder -------------------------

BREAK_MINUTES = 15


def check_break_reminder(twin, working=True):
    """After 15 continuous minutes -> popup to take a 2-minute break."""
    last = twin.get("session_start")
    now = datetime.utcnow()
    if last:
        last_dt = datetime.fromisoformat(last.rstrip("Z"))
        minutes = (now - last_dt).total_seconds() / 60
    else:
        twin["session_start"] = now.isoformat() + "Z"
        return {"reminder": False, "minutes": 0}

    last_rem = twin.get("last_break_reminder")
    if last_rem:
        last_rem_dt = datetime.fromisoformat(last_rem.rstrip("Z"))
        since_last = (now - last_rem_dt).total_seconds() / 60
    else:
        since_last = 999

    if minutes >= BREAK_MINUTES and since_last >= BREAK_MINUTES:
        twin["last_break_reminder"] = now.isoformat() + "Z"
        return {
            "reminder": True,
            "minutes": round(minutes, 1),
            "message": "You've been learning for a while. Take a 2-minute break, stretch, and come back refreshed!",
        }
    return {"reminder": False, "minutes": round(minutes, 1)}
