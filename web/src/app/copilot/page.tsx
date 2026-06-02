import { Suspense } from "react";
import { CopilotWorkspace } from "@/components/copilot/CopilotWorkspace";

export default function CopilotPage() {
  return (
    <Suspense>
      <CopilotWorkspace />
    </Suspense>
  );
}
