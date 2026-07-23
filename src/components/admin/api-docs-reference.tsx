"use client";

import { ApiReferenceReact } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";

type ApiDocsReferenceProps = {
  openApiYaml: string;
};

export function ApiDocsReference({ openApiYaml }: ApiDocsReferenceProps) {
  return (
    <div className="api-docs-scalar min-h-0 w-full flex-1">
      <ApiReferenceReact
        configuration={{
          content: openApiYaml,
          darkMode: true,
          forceDarkModeState: "dark",
          hideDarkModeToggle: true,
          theme: "saturn",
          layout: "modern",
          showSidebar: true,
          documentDownloadType: "yaml",
          servers: [
            {
              url: "/api/v1",
              description: "Este ambiente",
            },
          ],
          metaData: {
            title: "Agenda Barbearia API",
          },
        }}
      />
    </div>
  );
}
