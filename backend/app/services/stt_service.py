import unicodedata
import re
from difflib import SequenceMatcher

def normalize_vietnamese(text: str) -> str:
    """Normalize Vietnamese text for comparison."""
    text = unicodedata.normalize("NFC", text)
    text = text.lower().strip()
    text = re.sub(r'[^\w\s]', '', text)  # Remove punctuation
    text = re.sub(r'\s+', ' ', text)  # Normalize whitespace
    return text

def tokenize(text: str) -> list:
    """Split text into words."""
    return normalize_vietnamese(text).split()

def evaluate_reading(reference_text: str, spoken_text: str) -> dict:
    """Compare spoken text against reference text and return evaluation."""
    ref_words = tokenize(reference_text)
    spoken_words = tokenize(spoken_text)
    
    if not ref_words:
        return {
            "accuracy": 0,
            "correct_words": [],
            "wrong_words": [],
            "missing_words": [],
            "extra_words": spoken_words,
            "total_words": 0,
            "correct_count": 0,
            "feedback": "Chưa có văn bản để so sánh."
        }
    
    matcher = SequenceMatcher(None, ref_words, spoken_words)
    
    correct_words = []
    wrong_words = []
    missing_words = []
    extra_words = []
    
    for op, i1, i2, j1, j2 in matcher.get_opcodes():
        if op == 'equal':
            correct_words.extend(ref_words[i1:i2])
        elif op == 'replace':
            for k in range(max(i2 - i1, j2 - j1)):
                ref_word = ref_words[i1 + k] if i1 + k < i2 else None
                spoken_word = spoken_words[j1 + k] if j1 + k < j2 else None
                if ref_word and spoken_word:
                    wrong_words.append({"expected": ref_word, "got": spoken_word})
                elif ref_word:
                    missing_words.append(ref_word)
                elif spoken_word:
                    extra_words.append(spoken_word)
        elif op == 'delete':
            missing_words.extend(ref_words[i1:i2])
        elif op == 'insert':
            extra_words.extend(spoken_words[j1:j2])
    
    total = len(ref_words)
    correct_count = len(correct_words)
    accuracy = round((correct_count / total) * 100) if total > 0 else 0
    
    # Generate kid-friendly feedback
    if accuracy >= 95:
        feedback = "🌟 Xuất sắc! Con đọc rất giỏi!"
    elif accuracy >= 80:
        feedback = "👏 Giỏi lắm! Chỉ còn vài từ cần luyện thêm."
    elif accuracy >= 60:
        feedback = "💪 Khá tốt! Cố gắng thêm nhé con!"
    elif accuracy >= 40:
        feedback = "📖 Cần luyện tập thêm. Đọc chậm và rõ hơn nhé!"
    else:
        feedback = "🌱 Hãy thử đọc chậm từng từ một nhé con!"
    
    return {
        "accuracy": accuracy,
        "correct_words": correct_words,
        "wrong_words": wrong_words,
        "missing_words": missing_words,
        "extra_words": extra_words,
        "total_words": total,
        "correct_count": correct_count,
        "feedback": feedback
    }
