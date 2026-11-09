# Scoring the backlog

What each score means to a scorer, whether an agent or the author. The values that each score accepts are defined in [`packages/model/src/scores.ts`](../../../packages/model/src/scores.ts); `top-right write-scores` refuses any other.

- **Urgency** is how soon the item must be done for its value to hold. 1 can wait indefinitely; 5 is overdue or blocks work that is due now.
- **Impact** is how much the item changes for the people it serves once done. 1 is cosmetic; 5 changes what the product can do or removes a serious failure.
- **Effort** is the item's size in points, on a Fibonacci-like scale: 1 is an edit of minutes, 13 is a change too large for one pull request.
- **Progress** is the fraction of the effort already done, from 0 to 1. Leave it unscored for an item that has not started.

Score from the issue's title, body, labels, and relations. Leave a score out when the issue does not give enough to judge it; an absent score keeps the item in the gutter, which is better than a guess that places it.

The author reviews each agent score on the chart, and an agent may write over the author's scores: The chart shows the cell that the agent moved an item from until the author keeps or corrects it.
