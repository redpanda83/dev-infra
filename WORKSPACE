workspace(
    name = "dev-infra",
    managed_directories = {"@npm": ["node_modules"]},
)

load("@bazel_tools//tools/build_defs/repo:http.bzl", "http_archive", "http_file")

# The PKG rules are needed to build tar packages for integration tests. The builtin
# rule in `@bazel_tools` is not Windows compatible and outdated.
http_archive(
    name = "rules_pkg",
    sha256 = "8a298e832762eda1830597d64fe7db58178aa84cd5926d76d5b744d6558941c2",
    urls = [
        "https://mirror.bazel.build/github.com/bazelbuild/rules_pkg/releases/download/0.7.0/rules_pkg-0.7.0.tar.gz",
        "https://github.com/bazelbuild/rules_pkg/releases/download/0.7.0/rules_pkg-0.7.0.tar.gz",
    ],
)

http_archive(
    name = "io_bazel_rules_sass",
    sha256 = "425d93db6667060db581aaaace7b77b3d7e114b41f36a0c5b86e5e9497832174",
    strip_prefix = "rules_sass-901d22c63864aa781b902b14c55c423117469286",
    urls = [
        "https://github.com/bazelbuild/rules_sass/archive/901d22c63864aa781b902b14c55c423117469286.zip",
    ],
)

# Fetch rules_nodejs and install its dependencies so we can install our npm dependencies.
http_archive(
    name = "build_bazel_rules_nodejs",
    sha256 = "dcc55f810142b6cf46a44d0180a5a7fb923c04a5061e2e8d8eb05ccccc60864b",
    urls = ["https://github.com/bazelbuild/rules_nodejs/releases/download/5.8.0/rules_nodejs-5.8.0.tar.gz"],
)

load("@build_bazel_rules_nodejs//:repositories.bzl", "build_bazel_rules_nodejs_dependencies")

build_bazel_rules_nodejs_dependencies()

load("@rules_nodejs//nodejs:repositories.bzl", "nodejs_register_toolchains")

nodejs_register_toolchains(
    name = "nodejs",
    node_version = "16.10.0",
)

load("@build_bazel_rules_nodejs//:index.bzl", "yarn_install")

yarn_install(
    name = "npm",
    # Yarn Berry/v2+ expects `--immutable` instead of `--frozen-lockfile`.
    args = ["--immutable"],
    data = [
        "//:.yarn/releases/yarn-3.2.3.cjs",
        "//:.yarnrc.yml",
    ],
    # Currently disabled due to:
    #  1. Missing Windows support currently.
    #  2. Incompatibilites with the `ts_library` rule.
    exports_directories_only = False,
    package_json = "//:package.json",
    # We prefer to symlink the `node_modules` to only maintain a single install.
    # See https://github.com/angular/dev-infra/pull/446#issuecomment-1059820287 for details.
    symlink_node_modules = True,
    yarn = "//:.yarn/releases/yarn-3.2.3.cjs",
    yarn_lock = "//:yarn.lock",
)

yarn_install(
    name = "ts_proto_npm",
    args = ["--immutable"],
    data = [
        "//:.yarn/releases/yarn-3.2.3.cjs",
        "//tools/ts_proto:.yarnrc.yml",
    ],
    exports_directories_only = False,
    package_json = "//tools/ts_proto:package.json",
    yarn = "//:.yarn/releases/yarn-3.2.3.cjs",
    yarn_lock = "//tools/ts_proto:yarn.lock",
)

load("@npm//@bazel/protractor:package.bzl", "npm_bazel_protractor_dependencies")

npm_bazel_protractor_dependencies()

load("@io_bazel_rules_webtesting//web:repositories.bzl", "web_test_repositories")

web_test_repositories()

load("//bazel/browsers:browser_repositories.bzl", "browser_repositories")

browser_repositories()

load("@build_bazel_rules_nodejs//toolchains/esbuild:esbuild_repositories.bzl", "esbuild_repositories")

esbuild_repositories(
    npm_repository = "npm",
)

load("@rules_pkg//:deps.bzl", "rules_pkg_dependencies")

rules_pkg_dependencies()

load("@io_bazel_rules_sass//:defs.bzl", "sass_repositories")

sass_repositories(
    yarn_script = "//:.yarn/releases/yarn-1.22.17.cjs",
)

register_toolchains(
    "//bazel/git-toolchain:git_linux_toolchain",
    "//bazel/git-toolchain:git_macos_x86_toolchain",
    "//bazel/git-toolchain:git_macos_arm64_toolchain",
    "//bazel/git-toolchain:git_windows_toolchain",
)

http_file(
    name = "bazel_test_status_proto",
    sha256 = "61ce1dc62fdcfd6d68624a403e0f04c5fd5136d933b681467aad1ad2d00dbb03",
    urls = ["https://raw.githubusercontent.com/bazelbuild/bazel/5.0.0/src/main/protobuf/test_status.proto"],
)
