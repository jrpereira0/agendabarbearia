"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const toastSurface = {
  "--normal-bg": "#151618",
  "--normal-bg-hover": "#1a1b1e",
  "--normal-border": "rgb(255 255 255 / 10%)",
  "--normal-border-hover": "rgb(255 255 255 / 16%)",
  "--normal-text": "#f5f5f5",
  "--success-bg": "rgb(236 241 94 / 12%)",
  "--success-border": "rgb(236 241 94 / 28%)",
  "--success-text": "#ecf15e",
  "--error-bg": "rgb(248 113 113 / 12%)",
  "--error-border": "rgb(248 113 113 / 28%)",
  "--error-text": "#fca5a5",
  "--warning-bg": "rgb(251 191 36 / 10%)",
  "--warning-border": "rgb(251 191 36 / 26%)",
  "--warning-text": "#fbbf24",
  "--info-bg": "rgb(255 255 255 / 6%)",
  "--info-border": "rgb(255 255 255 / 12%)",
  "--info-text": "#d4d5d8",
  "--border-radius": "0.875rem",
} as React.CSSProperties;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      richColors
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={toastSurface}
      toastOptions={{
        classNames: {
          toast: "cn-toast admin-toast",
          title: "admin-toast-title",
          description: "admin-toast-description",
          actionButton: "admin-toast-action",
          cancelButton: "admin-toast-cancel",
          closeButton: "admin-toast-close",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
