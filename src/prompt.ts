import type { GitHubCommit } from "./types";

export function buildPrompt(username: string, commits: GitHubCommit[]): string {
  const commitMessages = commits
    .map(
      (commit) =>
        `${commit.repository.full_name} - ${commit.commit.message}`,
    )
    .join("\n");

  return `Create a professional LinkedIn post in Brazilian Portuguese based **ONLY** on the relevant GitHub commits below made by ${username}.
## Core rule: factual accuracy

The GitHub commits provided are the **only source of truth**.

Do NOT invent, assume, exaggerate, or add information that is not directly supported by the commits.

Never invent:

* Technologies, frameworks, libraries, APIs, languages, or tools.
* Features, fixes, refactors, bugs, results, metrics, or improvements.
* Personal experiences, motivations, goals, challenges, feelings, or opinions.
* Business impact, user impact, or project impact.
* Future plans or intentions.
* Technical learnings that cannot reasonably be derived from the actual work.

If information is not supported by the commits, omit it.

## Repository coverage: do not omit relevant projects

The commits may belong to **multiple repositories/projects**.

Every repository containing at least one **relevant commit** must be represented in the final post.

Do NOT focus only on the repository with the most commits or the largest amount of activity.

Group the post by project/repository when multiple repositories contain relevant work.

For example:

💻 **Projeto A**

* [Concrete changes supported by its commits.]

💻 **Projeto B**

* [Concrete changes supported by its commits.]

💻 **Projeto C**

* [Concrete changes supported by its commits.]

A repository may contain multiple commits that are part of the same piece of work. In that case, consolidate them into a coherent summary instead of listing every commit separately.

Do not mention repositories that have no relevant commits.

## Determining relevance

Consider a commit relevant when it represents meaningful development activity, such as:

* A new feature.
* A bug fix.
* A refactor.
* An integration.
* A meaningful configuration or infrastructure change.
* A significant test improvement.
* A meaningful documentation change related to implemented functionality.
* A meaningful improvement to an existing system.

Do not give significant space to trivial changes such as:

* Formatting-only changes.
* Typographical corrections.
* Automated dependency updates without meaningful development context.
* Minor housekeeping that does not contribute to understanding the week's work.

However, **do not discard a repository entirely if it contains other relevant commits**.

## Analyze before writing

Before generating the post, internally analyze all commits and:

1. Group commits by repository.
2. Identify the main work performed in each repository.
3. Consolidate related commits.
4. Identify the most important technical changes.
5. Identify technologies and concepts explicitly supported by the commits.
6. Determine whether a meaningful technical learning can reasonably be derived.
7. Ensure that every repository with relevant work appears in the final post.

Do not expose this analysis.

## Post structure

Start with a concise overview of the week's main focus.

For example:

"Nesta semana, trabalhei em diferentes projetos, com foco em [factual summary of the main activities]."

Then organize the content by project.

### 💻 [Project/Repository Name]

[Concise summary of the relevant work performed in this repository.]

Mention concrete changes supported by the commits.

If appropriate, explain how multiple related commits contributed to the same development task.

Repeat this section for **EVERY repository with relevant commits**.

### 📚 Tecnologias e conceitos aplicados

Include this section only when the commits provide enough information.

Mention only technologies, tools, frameworks, APIs, programming languages, architectures, or technical concepts explicitly identifiable from the commits.

Do not add technologies simply because they would normally be associated with the work.

### 🧠 Aprendizados da semana

Include this section ONLY when the commits provide sufficient evidence for a reasonable technical learning.

The learning must be derived from the actual work represented by the commits.

Do not fabricate personal experiences or write generic statements such as:

* "Aprendi muito durante essa semana."
* "Foi uma experiência incrível."
* "A cada desafio, evoluo mais."
* "Aprendi a importância de trabalhar em equipe."

If the commits do not support a meaningful learning, omit this section entirely.

## Writing style

* Write in natural Brazilian Portuguese.
* Use a professional but human tone suitable for LinkedIn.
* Be concise but informative.
* Prefer concrete technical information over generic motivational language.
* Combine related commits into coherent narratives.
* Do not simply copy commit messages.
* Preserve the actual meaning of the commits.
* Do not exaggerate achievements or complexity.
* Do not claim success, performance improvements, scalability, security improvements, or user benefits unless supported by the commits.
* Avoid repetitive wording between projects.
* Give each relevant project enough space to be properly represented.
* Do not let one project overshadow the others simply because it has more commits.

## Handling limited information

If a repository has only a small number of relevant commits, mention it briefly rather than inventing additional context.

If there are many repositories, prioritize readability by keeping each project summary concise while still mentioning **all repositories with relevant commits**.

If a section has insufficient evidence, omit it.

If there are no relevant commits at all, return only:

"Não há informações suficientes nos commits para gerar um post significativo."

## Final output rules

Return **ONLY the final LinkedIn post**.

Do not include:

* Analysis.
* Explanations.
* Metadata.
* Commit hashes.
* Internal reasoning.
* Warnings.
* References to this prompt.
* References to AI generation.

Do not add a fabricated conclusion.

Do not add an engagement question.

Do not add hashtags unless explicitly supported by the provided information.

Commits:

${commitMessages}
`;
}
