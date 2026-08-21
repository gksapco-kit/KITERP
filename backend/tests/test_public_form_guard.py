from app.services.public_form_guard import (
    gmail_dot_abuse,
    is_honeypot_filled,
    looks_like_hash,
    score_public_form_spam,
)


def test_gmail_dot_abuse():
    assert gmail_dot_abuse("l.aw.re.n.c.etho.f.ma.n.n@gmail.com")
    assert not gmail_dot_abuse("ravi.kumar@gmail.com")
    assert not gmail_dot_abuse("hello@company.com")


def test_hash_message():
    assert looks_like_hash("FkZwCHRggWYyoEsdAjleZGM")
    assert not looks_like_hash("I want a demo of your ERP")
    assert not looks_like_hash("Hello")


def test_spam_score_matches_production_bots():
    score = score_public_form_spam(
        first_name="Aviu",
        last_name="Jsjwlv",
        email="l.aw.re.n.c.etho.f.ma.n.n@gmail.com",
        title="mpAyyHmEswZlO",
        message="FkZwCHRggWYyoEsdAjleZGM",
    )
    assert score >= 3


def test_real_enquiry_is_allowed():
    score = score_public_form_spam(
        first_name="Ravi",
        last_name="Kumar",
        email="ravi.kumar@infocomex.com",
        title="Founder",
        company="Infocomex",
        message="Please call me about KIT ERP pricing for our stores.",
    )
    assert score < 3


def test_honeypot():
    assert is_honeypot_filled("https://spam.example")
    assert not is_honeypot_filled("", None)
