"""LinkedIn lead mapping and webhook challenge signing."""
import hashlib
import hmac

from app.services.crm.linkedin_leads import linkedin_challenge_response, map_linkedin_lead


def test_challenge_response_is_hmac_sha256():
    code = "890e4665-4dfe-4d07-811c-b4d1184b5f8a"
    secret = "client-secret"
    expected = hmac.new(secret.encode(), code.encode(), hashlib.sha256).hexdigest()
    assert linkedin_challenge_response(code, secret) == expected


def test_map_linkedin_form_response_to_crm_lead():
    mapped = map_linkedin_lead({
        "id": "aaaabbbb-0000-cccc-1111-dddd2222eeee-5",
        "submittedAt": 1686182358881,
        "leadType": "SPONSORED",
        "testLead": False,
        "leadMetadataInfo": {
            "sponsoredLeadMetadataInfo": {
                "campaign": {"name": "Brand awareness - May"},
            },
        },
        "form": {
            "name": "Demo request",
            "content": {
                "questions": [
                    {"questionId": 1, "name": "firstName", "predefinedField": "FIRST_NAME"},
                    {"questionId": 2, "name": "lastName", "predefinedField": "LAST_NAME"},
                    {"questionId": 3, "name": "email", "predefinedField": "EMAIL"},
                    {"questionId": 4, "name": "company", "predefinedField": "COMPANY_NAME"},
                    {"questionId": 5, "name": "title", "predefinedField": "JOB_TITLE"},
                    {"questionId": 6, "name": "phone", "predefinedField": "PHONE_NUMBER"},
                ],
            },
        },
        "formResponse": {
            "answers": [
                {"questionId": 1, "answerDetails": {"textQuestionAnswer": {"answer": "Ada"}}},
                {"questionId": 2, "answerDetails": {"textQuestionAnswer": {"answer": "Lovelace"}}},
                {"questionId": 3, "answerDetails": {"textQuestionAnswer": {"answer": "ada@example.com"}}},
                {"questionId": 4, "answerDetails": {"textQuestionAnswer": {"answer": "Analytical Engines"}}},
                {"questionId": 5, "answerDetails": {"textQuestionAnswer": {"answer": "Founder"}}},
                {"questionId": 6, "answerDetails": {"textQuestionAnswer": {"answer": "+919800000000"}}},
            ],
        },
    })

    assert mapped["source"] == "linkedin"
    assert mapped["first_name"] == "Ada"
    assert mapped["last_name"] == "Lovelace"
    assert mapped["email"] == "ada@example.com"
    assert mapped["company"] == "Analytical Engines"
    assert mapped["title"] == "Founder"
    assert mapped["phone"] == "+919800000000"
    assert mapped["source_campaign"] == "Brand awareness - May"
    assert mapped["custom_fields"]["linkedin_dedupe_key"].endswith("_1686182358881")
