import { Link } from "react-router-dom";
import { Calendar, Clock, Tag, Twitter, Facebook, Linkedin, Link as LinkIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { BlogPost } from "../types";

export function BlogListing({ posts }: { posts: BlogPost[] }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {posts.map((p) => (
        <Card key={p.id} className="overflow-hidden flex flex-col">
          <Link to={`/blog/${p.slug}`} className="block aspect-[16/9] overflow-hidden">
            <img src={p.cover} alt={p.title} className="w-full h-full object-cover hover:scale-105 transition-transform" />
          </Link>
          <CardContent className="p-5 flex-1 flex flex-col gap-2">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{p.date}</span>
              <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{p.readingMinutes ?? 5} min</span>
            </div>
            <Link to={`/blog/${p.slug}`} className="font-semibold leading-snug hover:underline line-clamp-2">{p.title}</Link>
            <p className="text-sm text-muted-foreground line-clamp-3">{p.excerpt}</p>
            <div className="mt-auto flex items-center justify-between pt-3">
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6"><AvatarImage src={p.author.avatarUrl} /><AvatarFallback>{p.author.name[0]}</AvatarFallback></Avatar>
                <span className="text-xs text-muted-foreground">{p.author.name}</span>
              </div>
              <div className="flex gap-1">{p.tags?.slice(0, 2).map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}</div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function BlogPostDetail({ post, related = [] }: { post: BlogPost; related?: BlogPost[] }) {
  return (
    <article className="max-w-3xl mx-auto">
      <header className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {post.category && <Badge>{post.category}</Badge>}
          <span>·</span>
          <span>{post.date}</span>
          <span>·</span>
          <span>{post.readingMinutes ?? 5} min read</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">{post.title}</h1>
        <p className="text-lg text-muted-foreground">{post.excerpt}</p>
        <img src={post.cover} alt={post.title} className="aspect-[16/9] w-full rounded-lg object-cover" />
      </header>

      <div className="prose prose-neutral dark:prose-invert mt-8 max-w-none whitespace-pre-line">
        {post.content}
      </div>

      <Separator className="my-8" />

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12"><AvatarImage src={post.author.avatarUrl} /><AvatarFallback>{post.author.name[0]}</AvatarFallback></Avatar>
          <div>
            <div className="text-sm font-medium">{post.author.name}</div>
            {post.author.bio && <div className="text-xs text-muted-foreground max-w-md">{post.author.bio}</div>}
          </div>
        </div>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost"><Twitter /></Button>
          <Button size="icon" variant="ghost"><Facebook /></Button>
          <Button size="icon" variant="ghost"><Linkedin /></Button>
          <Button size="icon" variant="ghost" onClick={() => navigator.clipboard.writeText(window.location.href)}><LinkIcon /></Button>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold mb-4">Related posts</h2>
          <BlogListing posts={related.slice(0, 3)} />
        </section>
      )}
    </article>
  );
}

export function CategoryTagSidebar({
  categories, tags, activeCategory, activeTag, onCategoryChange, onTagChange,
}: {
  categories: string[]; tags: string[];
  activeCategory?: string | null; activeTag?: string | null;
  onCategoryChange?: (c: string | null) => void; onTagChange?: (t: string | null) => void;
}) {
  return (
    <aside className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold mb-2">Categories</h3>
        <div className="flex flex-col gap-1">
          <button onClick={() => onCategoryChange?.(null)} className={`text-sm text-left rounded px-2 py-1 hover:bg-muted ${!activeCategory ? "bg-muted font-medium" : ""}`}>All</button>
          {categories.map((c) => (
            <button key={c} onClick={() => onCategoryChange?.(c)} className={`text-sm text-left rounded px-2 py-1 hover:bg-muted ${activeCategory === c ? "bg-muted font-medium" : ""}`}>{c}</button>
          ))}
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold mb-2">Tags</h3>
        <div className="flex flex-wrap gap-1">
          {tags.map((t) => (
            <button key={t} onClick={() => onTagChange?.(activeTag === t ? null : t)}>
              <Badge variant={activeTag === t ? "default" : "secondary"} className="cursor-pointer"><Tag className="h-3 w-3 mr-1" />{t}</Badge>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
