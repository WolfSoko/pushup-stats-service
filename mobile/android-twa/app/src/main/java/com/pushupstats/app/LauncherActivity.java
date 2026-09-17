/*
 * Copyright 2020 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package com.pushupstats.app;

import android.net.Uri;



public class LauncherActivity
        extends com.google.androidbrowserhelper.trusted.LauncherActivity {




    // Bubblewrap generates an onCreate override here that pins the splash screen
    // to portrait via setRequestedOrientation. It is deliberately absent: Android
    // 16 ignores orientation restrictions on large screens anyway, and the Play
    // Console flags the call as a large-screen compatibility issue. Do not let a
    // `bubblewrap update` write it back — see docs/android-twa-wrapper.md.

    @Override
    protected Uri getLaunchingUrl() {
        // Get the original launch Url.
        Uri uri = super.getLaunchingUrl();

        

        return uri;
    }
}
