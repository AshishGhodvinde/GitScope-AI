package com.gitscope.github;

import com.gitscope.exception.RepositoryIndexingException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;

@Service
@Slf4j
public class GitHubService {

    private static final Set<String> SUPPORTED_EXTENSIONS = Set.of(
            ".java", ".js", ".jsx", ".ts", ".tsx",
            ".json", ".yml", ".yaml", ".md", ".xml", ".gradle"
    );

    private static final Set<String> IGNORED_DIRECTORIES = Set.of(
            "node_modules", "target", "build", "dist",
            "coverage", ".git", ".idea", ".vscode", "__pycache__"
    );

    @Value("${github.clone-dir:./tmp/repos}")
    private String cloneBaseDir;

    @Value("${github.max-file-size-mb:20}")
    private int maxFileSizeMb;

    @Value("${github.max-files:500}")
    private int maxFiles;

    public File cloneRepository(String repositoryUrl) {
        String repoName = extractRepoName(repositoryUrl);
        File cloneDir = new File(cloneBaseDir, repoName + "_" + System.currentTimeMillis());

        log.info("Cloning repository: {} into {}", repositoryUrl, cloneDir.getAbsolutePath());

        try {
            cloneDir.mkdirs();

            ProcessBuilder pb = new ProcessBuilder(
                    "git", "clone",
                    "--depth=1",
                    "--single-branch",
                    "--no-tags",
                    "-q",
                    repositoryUrl,
                    cloneDir.getAbsolutePath()
            );
            pb.redirectErrorStream(true);
            pb.environment().put("GIT_TERMINAL_PROMPT", "0"); 

            Process process = pb.start();
            String output = new String(process.getInputStream().readAllBytes());
            boolean finished = process.waitFor(5, TimeUnit.MINUTES);

            if (!finished || process.exitValue() != 0) {
                cleanupDirectory(cloneDir);
                log.error("git clone failed (exit={}): {}", process.exitValue(), output);
                throw new RepositoryIndexingException(
                        "Failed to clone repository: " + repositoryUrl +
                        ". Ensure it is public. Details: " + output.trim());
            }

            log.info("Successfully cloned: {}", repositoryUrl);
            return cloneDir;

        } catch (IOException | InterruptedException e) {
            cleanupDirectory(cloneDir);
            throw new RepositoryIndexingException(
                    "Failed to clone repository: " + repositoryUrl + ". " + e.getMessage(), e);
        }
    }

    public List<File> scanSourceFiles(File repoDir) {
        List<File> sourceFiles = new ArrayList<>();
        long maxBytes = (long) maxFileSizeMb * 1024 * 1024;

        try {
            Files.walkFileTree(repoDir.toPath(), new SimpleFileVisitor<>() {

                @Override
                public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) {
                    String dirName = dir.getFileName().toString();
                    if (IGNORED_DIRECTORIES.contains(dirName)) {
                        return FileVisitResult.SKIP_SUBTREE;
                    }
                    return FileVisitResult.CONTINUE;
                }

                @Override
                public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) {
                    if (sourceFiles.size() >= maxFiles) {
                        return FileVisitResult.TERMINATE;
                    }

                    String fileName = file.getFileName().toString();
                    String extension = getExtension(fileName);

                    if (SUPPORTED_EXTENSIONS.contains(extension) && attrs.size() <= maxBytes) {
                        sourceFiles.add(file.toFile());
                    }
                    return FileVisitResult.CONTINUE;
                }
            });
        } catch (IOException e) {
            throw new RepositoryIndexingException("Failed to scan repository files", e);
        }

        log.info("Scanned {} supported files from: {}", sourceFiles.size(), repoDir.getName());
        return sourceFiles;
    }

    public List<String> getRelativePaths(File repoDir, List<File> files) {
        Path rootPath = repoDir.toPath();
        return files.stream()
                .map(f -> rootPath.relativize(f.toPath()).toString().replace("\\", "/"))
                .sorted()
                .toList();
    }

    public String extractRepoName(String url) {
        String[] parts = url.trim().replaceAll("\\.git$", "").split("/");
        return parts[parts.length - 1];
    }

    public String extractOwner(String url) {
        String[] parts = url.trim().replaceAll("\\.git$", "").split("/");
        return parts.length >= 2 ? parts[parts.length - 2] : "unknown";
    }

    public void cleanupDirectory(File dir) {
        if (dir != null && dir.exists()) {
            try (Stream<Path> paths = Files.walk(dir.toPath())) {
                paths.sorted(Comparator.reverseOrder())
                        .map(Path::toFile)
                        .forEach(File::delete);
                log.info("Cleaned up cloned repository: {}", dir.getName());
            } catch (IOException e) {
                log.warn("Failed to clean up directory: {}", dir.getAbsolutePath(), e);
            }
        }
    }

    private String getExtension(String fileName) {
        int dotIndex = fileName.lastIndexOf('.');
        return dotIndex >= 0 ? fileName.substring(dotIndex) : "";
    }
}
