import logging
from uuid import UUID
from typing import Optional, Union
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func

from app.models.notification import Notification

log = logging.getLogger(__name__)


def _coerce_reference_uuid(reference_id: Optional[Union[str, UUID]]) -> Optional[UUID]:
    if reference_id is None:
        return None
    if isinstance(reference_id, UUID):
        return reference_id
    try:
        return UUID(str(reference_id).strip())
    except (ValueError, TypeError, AttributeError):
        return None


class NotificationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _save_notification(
        self,
        vendor_id: UUID,
        title: str,
        message: str,
        notif_type: str = "order",
        channel: str = "in_app",
        reference_id: Optional[Union[str, UUID]] = None,
        reference_type: Optional[str] = None,
        user_id: Optional[UUID] = None,
        customer_id: Optional[UUID] = None,
    ) -> Notification:
        notif = Notification(
            vendor_id=vendor_id,
            user_id=user_id,
            customer_id=customer_id,
            title=title,
            message=message,
            type=notif_type,
            channel=channel,
            reference_id=_coerce_reference_uuid(reference_id),
            reference_type=reference_type,
        )
        self.db.add(notif)
        await self.db.flush()
        return notif

    async def notify_order_received(
        self,
        vendor_id: UUID,
        vendor_phone: Optional[str],
        vendor_name: Optional[str],
        order_number: str,
        total: float,
        order_id: UUID,
    ):
        """Notify the vendor that a new order has been received."""
        try:
            await self._save_notification(
                vendor_id=vendor_id,
                title="New Order Received",
                message=f"Order #{order_number} has been placed for ₹{total:.2f}.",
                notif_type="order",
                reference_id=order_id,
                reference_type="order",
            )
        except Exception as e:
            log.warning("Failed to save order-received notification: %s", e)

    async def notify_order_status(
        self,
        vendor_id: UUID,
        customer_phone: Optional[str],
        customer_name: Optional[str],
        vendor_name: Optional[str],
        order_number: str,
        status: str,
        order_id: UUID,
        customer_id: Optional[UUID] = None,
    ):
        """Notify the customer about an order status change."""
        try:
            await self._save_notification(
                vendor_id=vendor_id,
                customer_id=customer_id,
                title=f"Order #{order_number} - {status.replace('_', ' ').title()}",
                message=f"Your order #{order_number} from {vendor_name or 'the store'} is now {status.replace('_', ' ')}.",
                notif_type="order",
                reference_id=order_id,
                reference_type="order",
            )
        except Exception as e:
            log.warning("Failed to save order-status notification: %s", e)

    async def notify_low_stock(
        self,
        vendor_id: UUID,
        product_name: str,
        quantity: int,
        product_id: UUID,
    ):
        """Notify the vendor that a product is low on stock."""
        try:
            await self._save_notification(
                vendor_id=vendor_id,
                title="Low Stock Alert",
                message=f'"{product_name}" has only {quantity} unit(s) left. Consider restocking soon.',
                notif_type="inventory",
                reference_id=product_id,
                reference_type="product",
            )
        except Exception as e:
            log.warning("Failed to save low-stock notification: %s", e)

    async def notify_payment_received(
        self,
        vendor_id: UUID,
        order_number: str,
        amount: float,
        order_id: UUID,
    ):
        """Notify the vendor that a payment was received."""
        try:
            await self._save_notification(
                vendor_id=vendor_id,
                title="Payment Received",
                message=f"Payment of ₹{amount:.2f} received for Order #{order_number}.",
                notif_type="payment",
                reference_id=order_id,
                reference_type="order",
            )
        except Exception as e:
            log.warning("Failed to save payment notification: %s", e)

    async def notify_new_review(
        self,
        vendor_id: UUID,
        product_name: str,
        rating: int,
        product_id: UUID,
    ):
        """Notify the vendor that a new review was posted."""
        stars = "★" * rating + "☆" * (5 - rating)
        try:
            await self._save_notification(
                vendor_id=vendor_id,
                title="New Review Posted",
                message=f'A customer rated "{product_name}" {stars} ({rating}/5).',
                notif_type="review",
                reference_id=product_id,
                reference_type="product",
            )
        except Exception as e:
            log.warning("Failed to save review notification: %s", e)

    # ──────────────────────────────────────────────────────────────────
    # HR module notifications (recruitment, onboarding, performance,
    # compliance, training, ESS).  All best-effort: never raise.
    # ──────────────────────────────────────────────────────────────────
    async def notify_hr_event(
        self,
        vendor_id: UUID,
        title: str,
        message: str,
        notif_type: str = "hr",
        reference_id: Optional[Union[str, UUID]] = None,
        reference_type: Optional[str] = None,
        user_id: Optional[UUID] = None,
    ):
        """Generic HR notification helper used by the new HR service layer.

        Always wrapped in try/except so a notification failure cannot abort
        the parent transaction.
        """
        try:
            await self._save_notification(
                vendor_id=vendor_id,
                user_id=user_id,
                title=title,
                message=message,
                notif_type=notif_type,
                reference_id=reference_id,
                reference_type=reference_type,
            )
        except Exception as e:
            log.warning("Failed to save HR notification (%s): %s", title, e)

    async def notify_interview_scheduled(self, vendor_id, application_id, when, candidate_name):
        await self.notify_hr_event(
            vendor_id=vendor_id,
            title="Interview Scheduled",
            message=f"Interview with {candidate_name} on {when:%d %b %Y %H:%M}.",
            notif_type="hr.interview",
            reference_id=str(application_id),
            reference_type="application",
        )

    async def notify_application_stage(self, vendor_id, application_id, candidate_name, stage):
        await self.notify_hr_event(
            vendor_id=vendor_id,
            title="Application Updated",
            message=f"{candidate_name} moved to '{stage}'.",
            notif_type="hr.recruitment",
            reference_id=str(application_id),
            reference_type="application",
        )

    async def notify_review_assigned(self, vendor_id, review_id, employee_name, cycle_name):
        await self.notify_hr_event(
            vendor_id=vendor_id,
            title="Performance Review Assigned",
            message=f"Review for {employee_name} created in cycle '{cycle_name}'.",
            notif_type="hr.performance",
            reference_id=str(review_id),
            reference_type="review",
        )

    async def notify_policy_published(self, vendor_id, policy_id, title):
        await self.notify_hr_event(
            vendor_id=vendor_id,
            title="Policy Published",
            message=f"'{title}' has been published — please acknowledge.",
            notif_type="hr.compliance",
            reference_id=str(policy_id),
            reference_type="policy",
        )

    async def notify_certification_expiring(self, vendor_id, cert_id, name, days_left):
        await self.notify_hr_event(
            vendor_id=vendor_id,
            title="Certification Expiring",
            message=f"'{name}' expires in {days_left} day(s).",
            notif_type="hr.compliance",
            reference_id=str(cert_id),
            reference_type="certification",
        )

    async def notify_announcement(self, vendor_id, ann_id, title):
        await self.notify_hr_event(
            vendor_id=vendor_id,
            title="New Announcement",
            message=title,
            notif_type="hr.announcement",
            reference_id=str(ann_id),
            reference_type="announcement",
        )

    async def notify_expense_status(self, vendor_id, expense_id, claim_no, status):
        await self.notify_hr_event(
            vendor_id=vendor_id,
            title=f"Expense {status.title()}",
            message=f"Claim {claim_no} is now {status}.",
            notif_type="hr.expense",
            reference_id=str(expense_id),
            reference_type="expense_claim",
        )

    async def notify_ticket_event(self, vendor_id, ticket_id, ticket_no, subject, event):
        await self.notify_hr_event(
            vendor_id=vendor_id,
            title=f"Ticket {event}",
            message=f"#{ticket_no} — {subject}",
            notif_type="hr.helpdesk",
            reference_id=str(ticket_id),
            reference_type="ticket",
        )

    async def notify_training_enrolled(self, vendor_id, enrollment_id, program_name):
        await self.notify_hr_event(
            vendor_id=vendor_id,
            title="Training Enrolled",
            message=f"You have been enrolled in '{program_name}'.",
            notif_type="hr.training",
            reference_id=str(enrollment_id),
            reference_type="enrollment",
        )

    async def get_vendor_notifications(
        self,
        vendor_id: UUID,
        limit: int = 50,
        unread_only: bool = False,
        notif_type: Optional[str] = None,
    ):
        query = select(Notification).where(
            Notification.vendor_id == vendor_id,
            Notification.customer_id.is_(None),
        )
        if unread_only:
            query = query.where(Notification.is_read == False)
        if notif_type:
            query = query.where(Notification.type == notif_type)
        query = query.order_by(Notification.created_at.desc()).limit(limit)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_vendor_notification_stats(self, vendor_id: UUID) -> dict:
        """Return unread counts per notification type."""
        base = select(Notification.type, func.count().label("cnt")).where(
            Notification.vendor_id == vendor_id,
            Notification.customer_id.is_(None),
        )
        total_result = await self.db.execute(
            base.group_by(Notification.type)
        )
        unread_result = await self.db.execute(
            base.where(Notification.is_read == False).group_by(Notification.type)
        )
        total_by_type = {row.type: row.cnt for row in total_result}
        unread_by_type = {row.type: row.cnt for row in unread_result}
        return {
            "total": sum(total_by_type.values()),
            "unread": sum(unread_by_type.values()),
            "by_type": {
                t: {"total": total_by_type.get(t, 0), "unread": unread_by_type.get(t, 0)}
                for t in set(list(total_by_type) + list(unread_by_type))
            },
        }

    async def get_customer_notifications(
        self,
        vendor_id: UUID,
        customer_id: UUID,
        limit: int = 50,
        unread_only: bool = False,
    ):
        query = select(Notification).where(
            Notification.vendor_id == vendor_id,
            Notification.customer_id == customer_id,
        )
        if unread_only:
            query = query.where(Notification.is_read == False)
        query = query.order_by(Notification.created_at.desc()).limit(limit)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_customer_notification_stats(self, vendor_id: UUID, customer_id: UUID) -> dict:
        filt = (
            Notification.vendor_id == vendor_id,
            Notification.customer_id == customer_id,
        )
        total_result = await self.db.execute(
            select(func.count()).select_from(Notification).where(*filt)
        )
        unread_result = await self.db.execute(
            select(func.count())
            .select_from(Notification)
            .where(*filt, Notification.is_read == False)
        )
        total = int(total_result.scalar_one() or 0)
        unread = int(unread_result.scalar_one() or 0)
        return {"total": total, "unread": unread}

    async def mark_customer_notification_read(
        self, notification_id: UUID, vendor_id: UUID, customer_id: UUID
    ) -> Optional[Notification]:
        notif = await self.db.get(Notification, notification_id)
        if (
            not notif
            or notif.vendor_id != vendor_id
            or notif.customer_id != customer_id
        ):
            return None
        notif.is_read = True
        await self.db.flush()
        return notif

    async def mark_all_customer_notifications_read(
        self, vendor_id: UUID, customer_id: UUID
    ) -> int:
        stmt = (
            update(Notification)
            .where(
                Notification.vendor_id == vendor_id,
                Notification.customer_id == customer_id,
                Notification.is_read == False,
            )
            .values(is_read=True)
        )
        result = await self.db.execute(stmt)
        await self.db.flush()
        return result.rowcount

    async def mark_as_read(self, notification_id: UUID):
        notif = await self.db.get(Notification, notification_id)
        if notif:
            notif.is_read = True
            await self.db.flush()
        return notif

    async def mark_all_as_read(self, vendor_id: UUID) -> int:
        """Mark all unread vendor notifications as read; returns count updated."""
        stmt = (
            update(Notification)
            .where(
                Notification.vendor_id == vendor_id,
                Notification.customer_id.is_(None),
                Notification.is_read == False,
            )
            .values(is_read=True)
        )
        result = await self.db.execute(stmt)
        await self.db.flush()
        return result.rowcount
