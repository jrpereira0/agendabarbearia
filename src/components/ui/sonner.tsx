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
  "--normal-bg": "#1a1b1e",
  "--normal-bg-hover": "#222326",
  "--normal-border": "rgb(255 255 255 / 16%)",
  "--normal-border-hover": "rgb(255 255 255 / 22%)",
  "--normal-text": "#f5f5f5",
  "--success-bg": "#1c1e12",
  "--success-border": "rgb(236 241 94 / 45%)",
  "--success-text": "#f5f5f5",
  "--error-bg": "#241416",
  "--error-border": "rgb(248 113 113 / 45%)",
  "--error-text": "#f5f5f5",
  "--warning-bg": "#221c10",
  "--warning-border": "rgb(251 191 36 / 45%)",
  "--warning-text": "#f5f5f5",
  "--info-bg": "#1a1b1e",
  "--info-border": "rgb(255 255 255 / 16%)",
  "--info-text": "#f5f5f5",
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
