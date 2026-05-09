import { Page, Section } from "../KitLayout";
import { BlogListing, BlogPostDetail, CategoryTagSidebar } from "@/kit/blog/BlogBlocks";
import { mockBlogPosts } from "@/kit/mock";

export default function BlogShowcase() {
  const tags = Array.from(new Set(mockBlogPosts.flatMap((p) => p.tags ?? [])));
  const cats = Array.from(new Set(mockBlogPosts.map((p) => p.category!).filter(Boolean)));
  return (
    <Page title="Blog" intro="Listing, post detail and category/tag sidebar.">
      <Section title="Blog listing with sidebar">
        <div className="grid lg:grid-cols-[220px_1fr] gap-8">
          <CategoryTagSidebar categories={cats} tags={tags} />
          <BlogListing posts={mockBlogPosts} />
        </div>
      </Section>
      <Section title="Blog post detail">
        <BlogPostDetail post={mockBlogPosts[0]} related={mockBlogPosts.slice(1, 4)} />
      </Section>
    </Page>
  );
}
