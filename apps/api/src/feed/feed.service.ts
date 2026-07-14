import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { isAdmin } from '../common/is-admin';
import { Db, DB } from '../db/db.module';
import { postReactions, posts, users } from '../db/schema';
import { CreatePostDto, ReactDto } from './dto/feed.dto';

@Injectable()
export class FeedService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async list(userId: string) {
    const rows = await this.db
      .select({
        id: posts.id,
        type: posts.type,
        content: posts.content,
        createdAt: posts.createdAt,
        authorId: users.id,
        author: users.username,
        authorLevel: users.level,
      })
      .from(posts)
      .innerJoin(users, eq(posts.userId, users.id))
      .orderBy(desc(posts.createdAt))
      .limit(40);

    if (rows.length === 0) return [];

    const ids = rows.map((p) => p.id);
    const reactions = await this.db
      .select()
      .from(postReactions)
      .where(inArray(postReactions.postId, ids));

    const admin = await isAdmin(this.db, userId);

    return rows.map((post) => {
      const forPost = reactions.filter((r) => r.postId === post.id);
      const countFor = (t: string) => forPost.filter((r) => r.type === t).length;
      return {
        ...post,
        mine: post.authorId === userId,
        // Admins moderate: they may remove anyone's post, not just their own.
        canDelete: post.authorId === userId || admin,
        reactions: {
          salute: countFor('salute'),
          fire: countFor('fire'),
          keep_going: countFor('keep_going'),
        },
        myReactions: forPost.filter((r) => r.userId === userId).map((r) => r.type),
      };
    });
  }

  async create(userId: string, dto: CreatePostDto) {
    const [post] = await this.db
      .insert(posts)
      .values({ userId, type: 'quote', content: dto.content })
      .returning();
    return post;
  }

  /** Toggle a gamified reaction on/off. */
  async react(postId: string, userId: string, dto: ReactDto) {
    const [post] = await this.db
      .select({ id: posts.id })
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);
    if (!post) throw new NotFoundException('Post not found');

    const [existing] = await this.db
      .select({ id: postReactions.id })
      .from(postReactions)
      .where(
        and(
          eq(postReactions.postId, postId),
          eq(postReactions.userId, userId),
          eq(postReactions.type, dto.type),
        ),
      )
      .limit(1);

    if (existing) {
      await this.db.delete(postReactions).where(eq(postReactions.id, existing.id));
      return { reacted: false, type: dto.type };
    }
    await this.db.insert(postReactions).values({ postId, userId, type: dto.type });
    return { reacted: true, type: dto.type };
  }

  async remove(postId: string, userId: string) {
    const [post] = await this.db
      .select({ id: posts.id, userId: posts.userId })
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);
    if (!post) throw new NotFoundException('Post not found');

    // Users can only delete their own posts; admins can moderate any post.
    if (post.userId !== userId && !(await isAdmin(this.db, userId))) {
      throw new NotFoundException('Post not found');
    }

    await this.db.delete(posts).where(eq(posts.id, postId));
    return { ok: true };
  }
}
