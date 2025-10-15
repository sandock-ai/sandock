# Sandock Contributing Guide

Thank you for your interest in contributing to Sandock! 🎉

## Development Setup

1. **Prerequisites**:
   - Node.js >= 20
   - pnpm >= 9

2. **Clone and install**:
   ```bash
   git clone https://github.com/sandock-ai/sandock.git
   cd sandock
   pnpm install
   ```

3. **Build packages**:
   ```bash
   pnpm build
   ```

4. **Run tests**:
   ```bash
   pnpm test
   ```

## Project Structure

```
sandock/
├── packages/
│   └── sandock-js/     # TypeScript/JavaScript SDK
├── .github/
│   └── workflows/      # GitHub Actions
├── package.json        # Root package configuration
├── pnpm-workspace.yaml # pnpm workspace config
└── README.md
```

## Making Changes

1. **Create a branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**:
   - Write clear, concise commit messages
   - Follow existing code style
   - Add tests for new features
   - Update documentation

3. **Test your changes**:
   ```bash
   pnpm test
   pnpm lint
   pnpm typecheck
   ```

4. **Commit**:
   ```bash
   git commit -m "feat: add awesome feature"
   ```
   
   We follow [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat`: New feature
   - `fix`: Bug fix
   - `docs`: Documentation changes
   - `chore`: Maintenance tasks
   - `test`: Adding tests
   - `refactor`: Code refactoring

5. **Push and create PR**:
   ```bash
   git push origin feature/your-feature-name
   ```
   
   Then open a Pull Request on GitHub.

## Code Style

- TypeScript strict mode enabled
- Follow existing patterns in the codebase
- Use meaningful variable and function names
- Add JSDoc comments for public APIs

## Testing

- Write unit tests for new features
- Ensure all tests pass before submitting PR
- Aim for good test coverage

## Questions?

Feel free to open an issue or discussion on GitHub!

---

Thank you for contributing! 🙏
