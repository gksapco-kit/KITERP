import { Page, Section } from "../KitLayout";
import { ProfileEdit, ChangePasswordForm, AddressBook, NotificationPreferencesForm, WishlistPage } from "@/kit/account/AccountBlocks";
import { mockUser, mockAddresses, mockWishlist } from "@/kit/mock";

export default function AccountShowcase() {
  return (
    <Page title="Account" intro="Profile, password, address book, notification preferences and wishlist.">
      <Section title="Edit profile"><div className="max-w-2xl"><ProfileEdit user={mockUser} /></div></Section>
      <Section title="Change password"><div className="max-w-md"><ChangePasswordForm /></div></Section>
      <Section title="Address book"><div className="max-w-2xl"><AddressBook addresses={mockAddresses} /></div></Section>
      <Section title="Notification preferences"><div className="max-w-2xl"><NotificationPreferencesForm /></div></Section>
      <Section title="Wishlist page" description="Grid/list toggle, share link, move-to-cart, remove."><WishlistPage items={mockWishlist} /></Section>
    </Page>
  );
}
