/* Copyright 2026 Centro Nacional de Inteligencia Artificial (CENIA, Chile). All rights reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License. */

import { invalidatePublishedConfig } from "@/customization/server";

// Called by the editor right after publishing so this server renders the new
// version immediately instead of after its cache expires (other instances
// catch up within 30 seconds). It only drops a cache, so it needs no auth.
export const dynamic = "force-dynamic";

export async function POST() {
  invalidatePublishedConfig();
  return new Response(null, { status: 204 });
}
