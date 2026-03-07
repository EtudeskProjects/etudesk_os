import { ActivityComment } from '../../types/activity';

export interface OptimisticComment extends ActivityComment {
  _optimistic?: boolean;
  _tempId?: string;
}

export function addReplyToComment(
  comments: OptimisticComment[],
  targetId: string,
  newReply: OptimisticComment
): OptimisticComment[] {
  return comments.map((comment) => {
    if (comment.id === targetId) {
      return {
        ...comment,
        replies: [newReply, ...(comment.replies || [])],
      };
    }
    if (comment.replies && comment.replies.length > 0) {
      return {
        ...comment,
        replies: addReplyToComment(comment.replies as OptimisticComment[], targetId, newReply),
      };
    }
    return comment;
  });
}

export function replaceOptimisticComment(
  comments: OptimisticComment[],
  targetTempId: string,
  replacement: ActivityComment
): OptimisticComment[] {
  return comments.map((comment) => {
    if (comment._tempId === targetTempId) {
      return {
        ...replacement,
        _optimistic: undefined,
        _tempId: undefined,
      } as OptimisticComment;
    }
    if (comment.replies && comment.replies.length > 0) {
      return {
        ...comment,
        replies: replaceOptimisticComment(
          comment.replies as OptimisticComment[],
          targetTempId,
          replacement
        ),
      };
    }
    return comment;
  });
}

export function removeOptimisticComment(
  comments: OptimisticComment[],
  targetTempId: string
): OptimisticComment[] {
  return comments
    .filter((comment) => comment._tempId !== targetTempId)
    .map((comment) => {
      if (comment.replies && comment.replies.length > 0) {
        return {
          ...comment,
          replies: removeOptimisticComment(comment.replies as OptimisticComment[], targetTempId),
        };
      }
      return comment;
    });
}

export function deleteCommentFromTree(
  comments: OptimisticComment[],
  targetId: string
): OptimisticComment[] {
  return comments
    .filter((comment) => comment.id !== targetId)
    .map((comment) => {
      if (comment.replies && comment.replies.length > 0) {
        return {
          ...comment,
          replies: deleteCommentFromTree(comment.replies as OptimisticComment[], targetId),
        };
      }
      return comment;
    });
}
