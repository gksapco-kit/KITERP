import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/@fs/storefront-web/src/components/ui/sheet.tsx");import { jsxDEV } from "/node_modules/react/jsx-dev-runtime.js";
import * as RefreshRuntime from "/@react-refresh";
const inWebWorker = typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope;
let prevRefreshReg;
let prevRefreshSig;
if (import.meta.hot && !inWebWorker) {
  if (!window.$RefreshReg$) {
    throw new Error(
      "@vitejs/plugin-react can't detect preamble. Something is wrong."
    );
  }
  prevRefreshReg = window.$RefreshReg$;
  prevRefreshSig = window.$RefreshSig$;
  window.$RefreshReg$ = RefreshRuntime.getRefreshReg("/storefront-web/src/components/ui/sheet.tsx");
  window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform;
}
import * as SheetPrimitive from "/node_modules/@radix-ui/react-dialog/dist/index.js";
import { cva } from "/node_modules/class-variance-authority/dist/index.js";
import { X } from "/node_modules/lucide-react/dist/cjs/lucide-react.js";
import * as React from "/node_modules/react/index.js";
import { cn } from "/@fs/storefront-web/src/lib/utils.ts";
const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;
const SheetPortal = SheetPrimitive.Portal;
const SheetOverlay = React.forwardRef(
  _c = ({ className, ...props }, ref) => /* @__PURE__ */ jsxDEV(
    SheetPrimitive.Overlay,
    {
      className: cn(
        "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className
      ),
      ...props,
      ref
    },
    void 0,
    false,
    {
      fileName: "/storefront-web/src/components/ui/sheet.tsx",
      lineNumber: 39,
      columnNumber: 1
    },
    this
  )
);
_c2 = SheetOverlay;
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;
const sheetVariants = cva(
  "fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom: "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
        right: "inset-y-0 right-0 h-full w-3/4  border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm"
      }
    },
    defaultVariants: {
      side: "right"
    }
  }
);
const SheetContent = React.forwardRef(
  _c3 = ({ side = "right", className, children, ...props }, ref) => /* @__PURE__ */ jsxDEV(SheetPortal, { children: [
    /* @__PURE__ */ jsxDEV(SheetOverlay, {}, void 0, false, {
      fileName: "/storefront-web/src/components/ui/sheet.tsx",
      lineNumber: 76,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV(SheetPrimitive.Content, { ref, className: cn(sheetVariants({ side }), className), ...props, children: [
      children,
      /* @__PURE__ */ jsxDEV(SheetPrimitive.Close, { className: "absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity data-[state=open]:bg-secondary hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none", children: [
        /* @__PURE__ */ jsxDEV(X, { className: "h-4 w-4" }, void 0, false, {
          fileName: "/storefront-web/src/components/ui/sheet.tsx",
          lineNumber: 80,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("span", { className: "sr-only", children: "Close" }, void 0, false, {
          fileName: "/storefront-web/src/components/ui/sheet.tsx",
          lineNumber: 81,
          columnNumber: 11
        }, this)
      ] }, void 0, true, {
        fileName: "/storefront-web/src/components/ui/sheet.tsx",
        lineNumber: 79,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "/storefront-web/src/components/ui/sheet.tsx",
      lineNumber: 77,
      columnNumber: 7
    }, this)
  ] }, void 0, true, {
    fileName: "/storefront-web/src/components/ui/sheet.tsx",
    lineNumber: 75,
    columnNumber: 1
  }, this)
);
_c4 = SheetContent;
SheetContent.displayName = SheetPrimitive.Content.displayName;
const SheetHeader = ({ className, ...props }) => /* @__PURE__ */ jsxDEV("div", { className: cn("flex flex-col space-y-2 text-center sm:text-left", className), ...props }, void 0, false, {
  fileName: "/storefront-web/src/components/ui/sheet.tsx",
  lineNumber: 90,
  columnNumber: 1
}, this);
_c5 = SheetHeader;
SheetHeader.displayName = "SheetHeader";
const SheetFooter = ({ className, ...props }) => /* @__PURE__ */ jsxDEV("div", { className: cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className), ...props }, void 0, false, {
  fileName: "/storefront-web/src/components/ui/sheet.tsx",
  lineNumber: 95,
  columnNumber: 1
}, this);
_c6 = SheetFooter;
SheetFooter.displayName = "SheetFooter";
const SheetTitle = React.forwardRef(
  _c7 = ({ className, ...props }, ref) => /* @__PURE__ */ jsxDEV(SheetPrimitive.Title, { ref, className: cn("text-lg font-semibold text-foreground", className), ...props }, void 0, false, {
    fileName: "/storefront-web/src/components/ui/sheet.tsx",
    lineNumber: 103,
    columnNumber: 1
  }, this)
);
_c8 = SheetTitle;
SheetTitle.displayName = SheetPrimitive.Title.displayName;
const SheetDescription = React.forwardRef(
  _c9 = ({ className, ...props }, ref) => /* @__PURE__ */ jsxDEV(SheetPrimitive.Description, { ref, className: cn("text-sm text-muted-foreground", className), ...props }, void 0, false, {
    fileName: "/storefront-web/src/components/ui/sheet.tsx",
    lineNumber: 111,
    columnNumber: 1
  }, this)
);
_c0 = SheetDescription;
SheetDescription.displayName = SheetPrimitive.Description.displayName;
export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger
};
var _c, _c2, _c3, _c4, _c5, _c6, _c7, _c8, _c9, _c0;
$RefreshReg$(_c, "SheetOverlay$React.forwardRef");
$RefreshReg$(_c2, "SheetOverlay");
$RefreshReg$(_c3, "SheetContent$React.forwardRef");
$RefreshReg$(_c4, "SheetContent");
$RefreshReg$(_c5, "SheetHeader");
$RefreshReg$(_c6, "SheetFooter");
$RefreshReg$(_c7, "SheetTitle$React.forwardRef");
$RefreshReg$(_c8, "SheetTitle");
$RefreshReg$(_c9, "SheetDescription$React.forwardRef");
$RefreshReg$(_c0, "SheetDescription");
if (import.meta.hot && !inWebWorker) {
  window.$RefreshReg$ = prevRefreshReg;
  window.$RefreshSig$ = prevRefreshSig;
}
if (import.meta.hot && !inWebWorker) {
  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh("/storefront-web/src/components/ui/sheet.tsx", currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate("/storefront-web/src/components/ui/sheet.tsx", currentExports, nextExports);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}

//# sourceMappingURL=data:application/json;base64,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QUFBO0FBQUE7QUFBQTtBQUFBLFNBQTZHO0FBQzlHO0FBQUV3QixNQUxHRjtBQU1OQSxXQUFXbkIsY0FBY3BCLGVBQWUwQyxNQUFNdEI7QUFFOUMsTUFBTXVCLG1CQUFtQnhDLE1BQU1XO0FBQUFBLEVBRzlCOEIsTUFBQ0EsQ0FBQyxFQUFFNUIsV0FBVyxHQUFHQyxNQUFNLEdBQUdDLFFBQzFCLHVCQUFDLGVBQWUsYUFBZixFQUEyQixLQUFVLFdBQVdkLEdBQUcsaUNBQWlDWSxTQUFTLEdBQUcsR0FBSUMsU0FBckc7QUFBQTtBQUFBO0FBQUE7QUFBQSxTQUEyRztBQUM1RztBQUFFNEIsTUFMR0Y7QUFNTkEsaUJBQWlCdkIsY0FBY3BCLGVBQWU4QyxZQUFZMUI7QUFFMUQ7QUFBQSxFQUNFZjtBQUFBQSxFQUNBSTtBQUFBQSxFQUNBcUI7QUFBQUEsRUFDQWE7QUFBQUEsRUFDQU47QUFBQUEsRUFDQUY7QUFBQUEsRUFDQXRCO0FBQUFBLEVBQ0FGO0FBQUFBLEVBQ0E0QjtBQUFBQSxFQUNBaEM7QUFBQUE7QUFDQSxJQUFBUSxJQUFBSSxLQUFBWSxLQUFBRSxLQUFBRyxLQUFBRSxLQUFBRSxLQUFBQyxLQUFBRyxLQUFBQztBQUFBLGFBQUE5QixJQUFBO0FBQUEsYUFBQUksS0FBQTtBQUFBLGFBQUFZLEtBQUE7QUFBQSxhQUFBRSxLQUFBO0FBQUEsYUFBQUcsS0FBQTtBQUFBLGFBQUFFLEtBQUE7QUFBQSxhQUFBRSxLQUFBO0FBQUEsYUFBQUMsS0FBQTtBQUFBLGFBQUFHLEtBQUE7QUFBQSxhQUFBQyxLQUFBIiwibmFtZXMiOlsiU2hlZXRQcmltaXRpdmUiLCJjdmEiLCJYIiwiUmVhY3QiLCJjbiIsIlNoZWV0IiwiUm9vdCIsIlNoZWV0VHJpZ2dlciIsIlRyaWdnZXIiLCJTaGVldENsb3NlIiwiQ2xvc2UiLCJTaGVldFBvcnRhbCIsIlBvcnRhbCIsIlNoZWV0T3ZlcmxheSIsImZvcndhcmRSZWYiLCJfYyIsImNsYXNzTmFtZSIsInByb3BzIiwicmVmIiwiX2MyIiwiZGlzcGxheU5hbWUiLCJPdmVybGF5Iiwic2hlZXRWYXJpYW50cyIsInZhcmlhbnRzIiwic2lkZSIsInRvcCIsImJvdHRvbSIsImxlZnQiLCJyaWdodCIsImRlZmF1bHRWYXJpYW50cyIsIlNoZWV0Q29udGVudCIsIl9jMyIsImNoaWxkcmVuIiwiX2M0IiwiQ29udGVudCIsIlNoZWV0SGVhZGVyIiwiX2M1IiwiU2hlZXRGb290ZXIiLCJfYzYiLCJTaGVldFRpdGxlIiwiX2M3IiwiX2M4IiwiVGl0bGUiLCJTaGVldERlc2NyaXB0aW9uIiwiX2M5IiwiX2MwIiwiRGVzY3JpcHRpb24iXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZXMiOlsic2hlZXQudHN4Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIFNoZWV0UHJpbWl0aXZlIGZyb20gXCJAcmFkaXgtdWkvcmVhY3QtZGlhbG9nXCI7XG5pbXBvcnQgeyBjdmEsIHR5cGUgVmFyaWFudFByb3BzIH0gZnJvbSBcImNsYXNzLXZhcmlhbmNlLWF1dGhvcml0eVwiO1xuaW1wb3J0IHsgWCB9IGZyb20gXCJsdWNpZGUtcmVhY3RcIjtcbmltcG9ydCAqIGFzIFJlYWN0IGZyb20gXCJyZWFjdFwiO1xuXG5pbXBvcnQgeyBjbiB9IGZyb20gXCJAL2xpYi91dGlsc1wiO1xuXG5jb25zdCBTaGVldCA9IFNoZWV0UHJpbWl0aXZlLlJvb3Q7XG5cbmNvbnN0IFNoZWV0VHJpZ2dlciA9IFNoZWV0UHJpbWl0aXZlLlRyaWdnZXI7XG5cbmNvbnN0IFNoZWV0Q2xvc2UgPSBTaGVldFByaW1pdGl2ZS5DbG9zZTtcblxuY29uc3QgU2hlZXRQb3J0YWwgPSBTaGVldFByaW1pdGl2ZS5Qb3J0YWw7XG5cbmNvbnN0IFNoZWV0T3ZlcmxheSA9IFJlYWN0LmZvcndhcmRSZWY8XG4gIFJlYWN0LkVsZW1lbnRSZWY8dHlwZW9mIFNoZWV0UHJpbWl0aXZlLk92ZXJsYXk+LFxuICBSZWFjdC5Db21wb25lbnRQcm9wc1dpdGhvdXRSZWY8dHlwZW9mIFNoZWV0UHJpbWl0aXZlLk92ZXJsYXk+XG4+KCh7IGNsYXNzTmFtZSwgLi4ucHJvcHMgfSwgcmVmKSA9PiAoXG4gIDxTaGVldFByaW1pdGl2ZS5PdmVybGF5XG4gICAgY2xhc3NOYW1lPXtjbihcbiAgICAgIFwiZml4ZWQgaW5zZXQtMCB6LTUwIGJnLWJsYWNrLzgwIGRhdGEtW3N0YXRlPW9wZW5dOmFuaW1hdGUtaW4gZGF0YS1bc3RhdGU9Y2xvc2VkXTphbmltYXRlLW91dCBkYXRhLVtzdGF0ZT1jbG9zZWRdOmZhZGUtb3V0LTAgZGF0YS1bc3RhdGU9b3Blbl06ZmFkZS1pbi0wXCIsXG4gICAgICBjbGFzc05hbWUsXG4gICAgKX1cbiAgICB7Li4ucHJvcHN9XG4gICAgcmVmPXtyZWZ9XG4gIC8+XG4pKTtcblNoZWV0T3ZlcmxheS5kaXNwbGF5TmFtZSA9IFNoZWV0UHJpbWl0aXZlLk92ZXJsYXkuZGlzcGxheU5hbWU7XG5cbmNvbnN0IHNoZWV0VmFyaWFudHMgPSBjdmEoXG4gIFwiZml4ZWQgei01MCBnYXAtNCBiZy1iYWNrZ3JvdW5kIHAtNiBzaGFkb3ctbGcgdHJhbnNpdGlvbiBlYXNlLWluLW91dCBkYXRhLVtzdGF0ZT1vcGVuXTphbmltYXRlLWluIGRhdGEtW3N0YXRlPWNsb3NlZF06YW5pbWF0ZS1vdXQgZGF0YS1bc3RhdGU9Y2xvc2VkXTpkdXJhdGlvbi0zMDAgZGF0YS1bc3RhdGU9b3Blbl06ZHVyYXRpb24tNTAwXCIsXG4gIHtcbiAgICB2YXJpYW50czoge1xuICAgICAgc2lkZToge1xuICAgICAgICB0b3A6IFwiaW5zZXQteC0wIHRvcC0wIGJvcmRlci1iIGRhdGEtW3N0YXRlPWNsb3NlZF06c2xpZGUtb3V0LXRvLXRvcCBkYXRhLVtzdGF0ZT1vcGVuXTpzbGlkZS1pbi1mcm9tLXRvcFwiLFxuICAgICAgICBib3R0b206XG4gICAgICAgICAgXCJpbnNldC14LTAgYm90dG9tLTAgYm9yZGVyLXQgZGF0YS1bc3RhdGU9Y2xvc2VkXTpzbGlkZS1vdXQtdG8tYm90dG9tIGRhdGEtW3N0YXRlPW9wZW5dOnNsaWRlLWluLWZyb20tYm90dG9tXCIsXG4gICAgICAgIGxlZnQ6IFwiaW5zZXQteS0wIGxlZnQtMCBoLWZ1bGwgdy0zLzQgYm9yZGVyLXIgZGF0YS1bc3RhdGU9Y2xvc2VkXTpzbGlkZS1vdXQtdG8tbGVmdCBkYXRhLVtzdGF0ZT1vcGVuXTpzbGlkZS1pbi1mcm9tLWxlZnQgc206bWF4LXctc21cIixcbiAgICAgICAgcmlnaHQ6XG4gICAgICAgICAgXCJpbnNldC15LTAgcmlnaHQtMCBoLWZ1bGwgdy0zLzQgIGJvcmRlci1sIGRhdGEtW3N0YXRlPWNsb3NlZF06c2xpZGUtb3V0LXRvLXJpZ2h0IGRhdGEtW3N0YXRlPW9wZW5dOnNsaWRlLWluLWZyb20tcmlnaHQgc206bWF4LXctc21cIixcbiAgICAgIH0sXG4gICAgfSxcbiAgICBkZWZhdWx0VmFyaWFudHM6IHtcbiAgICAgIHNpZGU6IFwicmlnaHRcIixcbiAgICB9LFxuICB9LFxuKTtcblxuaW50ZXJmYWNlIFNoZWV0Q29udGVudFByb3BzXG4gIGV4dGVuZHMgUmVhY3QuQ29tcG9uZW50UHJvcHNXaXRob3V0UmVmPHR5cGVvZiBTaGVldFByaW1pdGl2ZS5Db250ZW50PixcbiAgICBWYXJpYW50UHJvcHM8dHlwZW9mIHNoZWV0VmFyaWFudHM+IHt9XG5cbmNvbnN0IFNoZWV0Q29udGVudCA9IFJlYWN0LmZvcndhcmRSZWY8UmVhY3QuRWxlbWVudFJlZjx0eXBlb2YgU2hlZXRQcmltaXRpdmUuQ29udGVudD4sIFNoZWV0Q29udGVudFByb3BzPihcbiAgKHsgc2lkZSA9IFwicmlnaHRcIiwgY2xhc3NOYW1lLCBjaGlsZHJlbiwgLi4ucHJvcHMgfSwgcmVmKSA9PiAoXG4gICAgPFNoZWV0UG9ydGFsPlxuICAgICAgPFNoZWV0T3ZlcmxheSAvPlxuICAgICAgPFNoZWV0UHJpbWl0aXZlLkNvbnRlbnQgcmVmPXtyZWZ9IGNsYXNzTmFtZT17Y24oc2hlZXRWYXJpYW50cyh7IHNpZGUgfSksIGNsYXNzTmFtZSl9IHsuLi5wcm9wc30+XG4gICAgICAgIHtjaGlsZHJlbn1cbiAgICAgICAgPFNoZWV0UHJpbWl0aXZlLkNsb3NlIGNsYXNzTmFtZT1cImFic29sdXRlIHJpZ2h0LTQgdG9wLTQgcm91bmRlZC1zbSBvcGFjaXR5LTcwIHJpbmctb2Zmc2V0LWJhY2tncm91bmQgdHJhbnNpdGlvbi1vcGFjaXR5IGRhdGEtW3N0YXRlPW9wZW5dOmJnLXNlY29uZGFyeSBob3ZlcjpvcGFjaXR5LTEwMCBmb2N1czpvdXRsaW5lLW5vbmUgZm9jdXM6cmluZy0yIGZvY3VzOnJpbmctcmluZyBmb2N1czpyaW5nLW9mZnNldC0yIGRpc2FibGVkOnBvaW50ZXItZXZlbnRzLW5vbmVcIj5cbiAgICAgICAgICA8WCBjbGFzc05hbWU9XCJoLTQgdy00XCIgLz5cbiAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJzci1vbmx5XCI+Q2xvc2U8L3NwYW4+XG4gICAgICAgIDwvU2hlZXRQcmltaXRpdmUuQ2xvc2U+XG4gICAgICA8L1NoZWV0UHJpbWl0aXZlLkNvbnRlbnQ+XG4gICAgPC9TaGVldFBvcnRhbD5cbiAgKSxcbik7XG5TaGVldENvbnRlbnQuZGlzcGxheU5hbWUgPSBTaGVldFByaW1pdGl2ZS5Db250ZW50LmRpc3BsYXlOYW1lO1xuXG5jb25zdCBTaGVldEhlYWRlciA9ICh7IGNsYXNzTmFtZSwgLi4ucHJvcHMgfTogUmVhY3QuSFRNTEF0dHJpYnV0ZXM8SFRNTERpdkVsZW1lbnQ+KSA9PiAoXG4gIDxkaXYgY2xhc3NOYW1lPXtjbihcImZsZXggZmxleC1jb2wgc3BhY2UteS0yIHRleHQtY2VudGVyIHNtOnRleHQtbGVmdFwiLCBjbGFzc05hbWUpfSB7Li4ucHJvcHN9IC8+XG4pO1xuU2hlZXRIZWFkZXIuZGlzcGxheU5hbWUgPSBcIlNoZWV0SGVhZGVyXCI7XG5cbmNvbnN0IFNoZWV0Rm9vdGVyID0gKHsgY2xhc3NOYW1lLCAuLi5wcm9wcyB9OiBSZWFjdC5IVE1MQXR0cmlidXRlczxIVE1MRGl2RWxlbWVudD4pID0+IChcbiAgPGRpdiBjbGFzc05hbWU9e2NuKFwiZmxleCBmbGV4LWNvbC1yZXZlcnNlIHNtOmZsZXgtcm93IHNtOmp1c3RpZnktZW5kIHNtOnNwYWNlLXgtMlwiLCBjbGFzc05hbWUpfSB7Li4ucHJvcHN9IC8+XG4pO1xuU2hlZXRGb290ZXIuZGlzcGxheU5hbWUgPSBcIlNoZWV0Rm9vdGVyXCI7XG5cbmNvbnN0IFNoZWV0VGl0bGUgPSBSZWFjdC5mb3J3YXJkUmVmPFxuICBSZWFjdC5FbGVtZW50UmVmPHR5cGVvZiBTaGVldFByaW1pdGl2ZS5UaXRsZT4sXG4gIFJlYWN0LkNvbXBvbmVudFByb3BzV2l0aG91dFJlZjx0eXBlb2YgU2hlZXRQcmltaXRpdmUuVGl0bGU+XG4+KCh7IGNsYXNzTmFtZSwgLi4ucHJvcHMgfSwgcmVmKSA9PiAoXG4gIDxTaGVldFByaW1pdGl2ZS5UaXRsZSByZWY9e3JlZn0gY2xhc3NOYW1lPXtjbihcInRleHQtbGcgZm9udC1zZW1pYm9sZCB0ZXh0LWZvcmVncm91bmRcIiwgY2xhc3NOYW1lKX0gey4uLnByb3BzfSAvPlxuKSk7XG5TaGVldFRpdGxlLmRpc3BsYXlOYW1lID0gU2hlZXRQcmltaXRpdmUuVGl0bGUuZGlzcGxheU5hbWU7XG5cbmNvbnN0IFNoZWV0RGVzY3JpcHRpb24gPSBSZWFjdC5mb3J3YXJkUmVmPFxuICBSZWFjdC5FbGVtZW50UmVmPHR5cGVvZiBTaGVldFByaW1pdGl2ZS5EZXNjcmlwdGlvbj4sXG4gIFJlYWN0LkNvbXBvbmVudFByb3BzV2l0aG91dFJlZjx0eXBlb2YgU2hlZXRQcmltaXRpdmUuRGVzY3JpcHRpb24+XG4+KCh7IGNsYXNzTmFtZSwgLi4ucHJvcHMgfSwgcmVmKSA9PiAoXG4gIDxTaGVldFByaW1pdGl2ZS5EZXNjcmlwdGlvbiByZWY9e3JlZn0gY2xhc3NOYW1lPXtjbihcInRleHQtc20gdGV4dC1tdXRlZC1mb3JlZ3JvdW5kXCIsIGNsYXNzTmFtZSl9IHsuLi5wcm9wc30gLz5cbikpO1xuU2hlZXREZXNjcmlwdGlvbi5kaXNwbGF5TmFtZSA9IFNoZWV0UHJpbWl0aXZlLkRlc2NyaXB0aW9uLmRpc3BsYXlOYW1lO1xuXG5leHBvcnQge1xuICBTaGVldCxcbiAgU2hlZXRDbG9zZSxcbiAgU2hlZXRDb250ZW50LFxuICBTaGVldERlc2NyaXB0aW9uLFxuICBTaGVldEZvb3RlcixcbiAgU2hlZXRIZWFkZXIsXG4gIFNoZWV0T3ZlcmxheSxcbiAgU2hlZXRQb3J0YWwsXG4gIFNoZWV0VGl0bGUsXG4gIFNoZWV0VHJpZ2dlcixcbn07XG4iXSwiZmlsZSI6Ii9zdG9yZWZyb250LXdlYi9zcmMvY29tcG9uZW50cy91aS9zaGVldC50c3gifQ==