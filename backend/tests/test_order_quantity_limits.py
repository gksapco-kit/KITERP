"""Per-order minimum and maximum quantity checks."""

from app.services.order_quantity_limits import quantity_limit_error


def test_minimum_blocks_quantity_below_the_saved_limit():
    message = quantity_limit_error(name="Chapati", qty=1, minimum=10, maximum=None)
    assert message == "Minimum 10 of Chapati required per order."


def test_quantity_at_the_minimum_is_allowed():
    assert quantity_limit_error(name="Chapati", qty=10, minimum=10, maximum=None) is None


def test_blank_minimum_allows_a_single_piece():
    assert quantity_limit_error(name="Chapati", qty=1, minimum=None, maximum=None) is None
    assert quantity_limit_error(name="Chapati", qty=1, minimum=1, maximum=None) is None


def test_removing_a_line_is_not_a_minimum_error():
    assert quantity_limit_error(name="Chapati", qty=0, minimum=10, maximum=None) is None
