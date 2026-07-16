# Contributing Guidelines

Thank you for contributing to HROS! To maintain high code quality and consistency, please follow these guidelines when writing code or making pull requests.

## 🛠️ Development Workflow

1. **Branch Naming Conventions**:
   - Features: `feature/your-feature-name`
   - Bugfixes: `bugfix/your-bug-name`
   - Refactor: `refactor/clean-up-name`
   - Docs: `docs/documentation-topic`

2. **Commit Message Format**:
   We follow semantic commit messages to ensure readability of git logs:
   - `feat: ...` for new features
   - `fix: ...` for bug fixes
   - `docs: ...` for documentation updates
   - `style: ...` for formatting or CSS adjustments
   - `refactor: ...` for code changes that neither fix a bug nor add a feature
   - `chore: ...` for building, dependencies, or tool configurations

3. **Code Style & Linting**:
   - Ensure all code is cleanly typed (no implicit `any` where avoidable).
   - Use typescript strict compiler configurations where possible.
   - Run typechecking before committing:
     ```bash
     pnpm --recursive run typecheck
     ```

## 🏗️ Pull Request Process

1. Create a branch from `main`.
2. Implement your changes, adding tests if applicable.
3. Verify that both the frontend (`hr-dashboard`) and backend (`api-server`) build cleanly.
4. Open a Pull Request referencing the issue or feature request.
