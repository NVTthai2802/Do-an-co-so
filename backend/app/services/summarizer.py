import re
import unicodedata


def _normalize(text):
    """Normalize Vietnamese text for processing."""
    return unicodedata.normalize("NFC", text).strip()


def _split_sentences(text):
    """Split Vietnamese text into sentences."""
    # Split on sentence-ending punctuation followed by whitespace or end
    parts = re.split(r'(?<=[.!?])\s+', text)
    sentences = [s.strip() for s in parts if s.strip() and len(s.strip()) > 5]
    return sentences


def _word_frequencies(text):
    """Calculate word frequencies, ignoring common Vietnamese stop words."""
    stop_words = {
        "và", "của", "là", "có", "được", "trong", "cho", "với", "này",
        "đã", "các", "một", "không", "những", "để", "từ", "theo",
        "về", "đến", "khi", "người", "trên", "ra", "còn", "hay",
        "hoặc", "nhưng", "nếu", "thì", "bị", "đó", "cũng", "rất",
        "hơn", "tại", "vào", "sau", "như", "do", "lại", "sẽ",
        "mà", "đang", "nên", "vì", "thế", "bởi", "qua",
        "the", "a", "an", "is", "are", "was", "were", "be",
        "in", "on", "at", "to", "for", "of", "and", "or", "but",
        "with", "that", "this", "it", "not", "by", "from", "as",
    }

    words = re.findall(r'\w+', text.lower())
    freq = {}
    for w in words:
        if w not in stop_words and len(w) > 1:
            freq[w] = freq.get(w, 0) + 1
    return freq


def _score_sentence(sentence, word_freq):
    """Score a sentence based on word frequency."""
    words = re.findall(r'\w+', sentence.lower())
    if not words:
        return 0
    score = sum(word_freq.get(w, 0) for w in words)
    # Normalize by length to avoid bias toward long sentences
    return score / (len(words) ** 0.5)


def summarize_text(text, ratio=0.3, max_sentences=5, min_sentences=1):
    """
    Extractive summarization: select most important sentences.

    Args:
        text: Input text to summarize
        ratio: Fraction of sentences to keep (default 30%)
        max_sentences: Maximum sentences in summary
        min_sentences: Minimum sentences in summary

    Returns:
        dict with summary text and metadata
    """
    text = _normalize(text)

    if not text:
        return {
            "summary": "",
            "original_length": 0,
            "summary_length": 0,
            "sentence_count": 0,
        }

    sentences = _split_sentences(text)

    if len(sentences) <= min_sentences:
        return {
            "summary": text,
            "original_length": len(text),
            "summary_length": len(text),
            "sentence_count": len(sentences),
        }

    # Calculate word frequencies across entire text
    word_freq = _word_frequencies(text)

    # Score each sentence
    scored = [(i, s, _score_sentence(s, word_freq)) for i, s in enumerate(sentences)]

    # Determine how many sentences to pick
    n = max(min_sentences, min(max_sentences, int(len(sentences) * ratio)))

    # Pick top-n by score, then re-order by original position
    top = sorted(scored, key=lambda x: x[2], reverse=True)[:n]
    top_ordered = sorted(top, key=lambda x: x[0])

    summary = " ".join(s for _, s, _ in top_ordered)

    return {
        "summary": summary,
        "original_length": len(text),
        "summary_length": len(summary),
        "sentence_count": len(top_ordered),
    }
