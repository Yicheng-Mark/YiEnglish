"""
Elllo.org 听力材料爬虫
用法: python scripts/crawl_elllo.py
依赖: pip install requests beautifulsoup4
"""
import requests
from bs4 import BeautifulSoup
import json
import os
import re
import hashlib
import random

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "..", "public", "audio", "elllo")
DATA_PATH = os.path.join(SCRIPT_DIR, "..", "src", "data", "listening-lessons.json")
os.makedirs(OUTPUT_DIR, exist_ok=True)

TARGET_URLS = [
    "https://www.elllo.org/english/1401/1432-6Minute-Chores.htm",
    "https://www.elllo.org/english/1401/1431-6Minute-Bamboo.htm",
    "https://www.elllo.org/english/1401/1430-6Minute-Names.htm",
    "https://www.elllo.org/english/1401/1429-6Minute-Mermaids.htm",
    "https://www.elllo.org/english/1401/1428-6Minute-Silence.htm",
]


def download_audio(url, filename):
    r = requests.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    with open(os.path.join(OUTPUT_DIR, filename), "wb") as f:
        f.write(r.content)
    print(f"  Downloaded: {filename}")


def parse_page(url):
    r = requests.get(url, headers=HEADERS, timeout=30)
    soup = BeautifulSoup(r.text, "html.parser")

    # Title
    title_tag = soup.find("h1") or soup.find("h2")
    title = title_tag.get_text(strip=True) if title_tag else "Untitled"

    # Audio URL
    audio_url = None
    audio_tag = soup.find("audio")
    if audio_tag and audio_tag.get("src"):
        audio_url = audio_tag["src"]
    else:
        for a in soup.find_all("a", href=re.compile(r"\.mp3$")):
            audio_url = a["href"]
            break

    if audio_url and audio_url.startswith("/"):
        audio_url = "https://www.elllo.org" + audio_url

    # Extract ID from URL
    url_match = re.search(r"/(\d+)-", url)
    source_id = url_match.group(1) if url_match else hashlib.md5(url.encode()).hexdigest()[:8]

    # Download audio
    audio_filename = f"{source_id}.mp3"
    if audio_url:
        try:
            download_audio(audio_url, audio_filename)
        except Exception as e:
            print(f"  Audio download failed: {e}")
            audio_filename = None

    # Transcript
    transcript = ""
    trans_div = soup.find(id="transcript") or soup.find(class_="transcript")
    if trans_div:
        paragraphs = trans_div.find_all("p")
        transcript = "\n".join(p.get_text(strip=True) for p in paragraphs)

    if not transcript:
        for p in soup.find_all("p"):
            text = p.get_text(strip=True)
            if len(text) > 200:
                transcript = text
                break

    # Split into sentences
    sentences = []
    if transcript:
        raw_sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', transcript) if len(s.strip()) > 15]
        for i, s in enumerate(raw_sentences[:10], 1):
            sentences.append({"id": i, "en": s, "zh": ""})

    # Generate choice questions from sentences
    questions = generate_questions(sentences, source_id)

    return {
        "id": f"elllo-{source_id}",
        "title": title,
        "level": "medium",
        "audioUrl": f"/audio/elllo/{audio_filename}" if audio_filename else None,
        "sourceUrl": url,
        "sentences": sentences,
        "choiceQuestions": questions,
    }


STOP_WORDS = {
    'the','a','an','is','are','was','were','be','been','have','has','had','do','does','did',
    'will','would','could','should','to','of','in','for','on','at','by','with','from','as',
    'and','but','or','so','it','this','that','they','them','their','there','then','than',
    'when','where','what','who','how','why','which','not','no','all','can','we','our','you',
    'your','he','she','his','her','my','its','if','up','out','just','about','into','over',
}


def generate_questions(sentences, lesson_id):
    """Generate simple choice questions from sentences by blanking a content word."""
    questions = []
    all_words = []
    for s in sentences:
        all_words.extend(s["en"].split())

    all_clean = [re.sub(r'[.,!?;:"\']', '', w).lower() for w in all_words]

    for i, s in enumerate(sentences[:5]):
        words = s["en"].split()
        content_words = [
            (re.sub(r'[.,!?;:"\']', '', w), idx)
            for idx, w in enumerate(words)
            if len(w) > 4 and w.lower() not in STOP_WORDS
        ]

        if not content_words:
            continue

        target_word, target_idx = random.choice(content_words)

        distractors = list(set(
            w for w in all_clean
            if w != target_word.lower()
            and abs(len(w) - len(target_word)) <= 2
        ))[:3]

        while len(distractors) < 3:
            distractors.append(f"option_{len(distractors)}")

        options = [target_word] + distractors[:3]
        random.shuffle(options)

        questions.append({
            "id": f"q{i+1}",
            "question": f"Which word do you hear in this sentence?\n\"{s['en']}\"",
            "options": options,
            "correctIndex": options.index(target_word),
        })

    return questions


def main():
    materials = []
    for url in TARGET_URLS:
        try:
            print(f"Crawling: {url}")
            mat = parse_page(url)
            if mat["sentences"] and mat["audioUrl"]:
                materials.append(mat)
                print(f"  OK: {mat['title']} ({len(mat['sentences'])} sentences, {len(mat['choiceQuestions'])} questions)")
            else:
                print(f"  SKIP (missing text or audio): {url}")
        except Exception as e:
            print(f"  FAILED: {e}")

    data = {"lessons": materials}
    os.makedirs(os.path.dirname(DATA_PATH), exist_ok=True)
    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"\nDone! {len(materials)} lessons -> {DATA_PATH}")


if __name__ == "__main__":
    main()
