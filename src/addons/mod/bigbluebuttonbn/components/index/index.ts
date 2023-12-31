// (C) Copyright 2015 Moodle Pty Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { Component, OnInit, Optional } from '@angular/core';
import { CoreError } from '@classes/errors/error';
import { CoreCourseModuleMainActivityComponent } from '@features/course/classes/main-activity-component';
import { CoreCourseContentsPage } from '@features/course/pages/contents/contents';
import { IonContent } from '@ionic/angular';
import { CoreApp } from '@services/app';
import { CoreGroupInfo, CoreGroups } from '@services/groups';
import { CoreSites } from '@services/sites';
import { CoreDomUtils } from '@services/utils/dom';
import { CoreTextUtils } from '@services/utils/text';
import { CoreTimeUtils } from '@services/utils/time';
import { CoreUtils } from '@services/utils/utils';
import { Translate } from '@singletons';
import { AddonModBBB, AddonModBBBData, AddonModBBBMeetingInfo, AddonModBBBService } from '../../services/bigbluebuttonbn';

/**
 * Component that displays a Big Blue Button activity.
 */
@Component({
    selector: 'addon-mod-bbb-index',
    templateUrl: 'index.html',
    styleUrls: ['index.scss'],
})
export class AddonModBBBIndexComponent extends CoreCourseModuleMainActivityComponent implements OnInit {

    component = AddonModBBBService.COMPONENT;
    moduleName = 'bigbluebuttonbn';
    bbb?: AddonModBBBData;
    groupInfo?: CoreGroupInfo;
    groupId = 0;
    meetingInfo?: AddonModBBBMeetingInfo;
    recordings?: RecordingData[];

    constructor(
        protected content?: IonContent,
        @Optional() courseContentsPage?: CoreCourseContentsPage,
    ) {
        super('AddonModBBBIndexComponent', content, courseContentsPage);
    }

    /**
     * @inheritdoc
     */
    async ngOnInit(): Promise<void> {
        super.ngOnInit();

        await this.loadContent();
    }

    get showRoom(): boolean {
        return !!this.meetingInfo && (!this.meetingInfo.features || this.meetingInfo.features.showroom);
    }

    get showRecordings(): boolean {
        return !!this.meetingInfo && (!this.meetingInfo.features || this.meetingInfo.features.showrecordings);
    }

    /**
     * @inheritdoc
     */
    protected async fetchContent(): Promise<void> {
        this.bbb = await AddonModBBB.getBBB(this.courseId, this.module.id);

        this.description = this.bbb.intro;
        this.dataRetrieved.emit(this.bbb);

        this.groupInfo = await CoreGroups.getActivityGroupInfo(this.module.id, false);

        this.groupId = CoreGroups.validateGroupId(this.groupId, this.groupInfo);

        if (this.groupInfo.separateGroups && !this.groupInfo.groups.length) {
            throw new CoreError(Translate.instant('addon.mod_bigbluebuttonbn.view_nojoin'));
        }

        await this.fetchMeetingInfo();

        await this.fetchRecordings();
    }

    /**
     * Get meeting info.
     *
     * @param updateCache Whether to update info cached data (in server).
     * @return Promise resolved when done.
     */
    async fetchMeetingInfo(updateCache?: boolean): Promise<void> {
        if (!this.bbb) {
            return;
        }

        try {
            this.meetingInfo = await AddonModBBB.getMeetingInfo(this.bbb.id, this.groupId, {
                cmId: this.module.id,
                updateCache,
            });

            if (this.meetingInfo.statusrunning && this.meetingInfo.userlimit > 0) {
                const count = (this.meetingInfo.participantcount || 0) + (this.meetingInfo.moderatorcount || 0);
                if (count === this.meetingInfo.userlimit) {
                    this.meetingInfo.statusmessage = Translate.instant('addon.mod_bigbluebuttonbn.userlimitreached');
                }
            }
        } catch (error) {
            if (error && error.errorcode === 'restrictedcontextexception') {
                error.message = Translate.instant('addon.mod_bigbluebuttonbn.view_nojoin');
            }

            throw error;
        }
    }

    /**
     * Get recordings.
     *
     * @return Promise resolved when done.
     */
    async fetchRecordings(): Promise<void> {
        if (!this.bbb || !this.showRecordings) {
            return;
        }

        const recordingsTable = await AddonModBBB.getRecordings(this.bbb.id, this.groupId, {
            cmId: this.module.id,
        });
        const columns = CoreUtils.arrayToObject(recordingsTable.columns, 'key');

        this.recordings = recordingsTable.parsedData.map(recordingData => {
            const playbackEl = CoreDomUtils.convertToElement(String(recordingData.playback));
            const playbackAnchor = playbackEl.querySelector('a');
            const details: RecordingDetailData[] = [];

            Object.entries(recordingData).forEach(([key, value]) => {
                const columnData = columns[key];
                if (!columnData || value === '' || key === 'actionbar') {
                    return;
                }

                if (columnData.formatter === 'customDate' && !isNaN(Number(value))) {
                    value = CoreTimeUtils.userDate(Number(value), 'core.strftimedaydate');
                } else if (columnData.allowHTML && typeof value === 'string') {
                    // If the HTML is empty, don't display it.
                    const valueElement = CoreDomUtils.convertToElement(value);
                    if (!valueElement.querySelector('img') && (valueElement.textContent ?? '').trim() === '') {
                        return;
                    }

                    if (key === 'playback') {
                        // Remove HTML, we're only interested in the text.
                        value = (valueElement.textContent ?? '').trim();
                    } else {
                        // Treat "quick edit" buttons, they aren't supported in the app.
                        const quickEditLink = valueElement.querySelector('.quickeditlink');
                        if (quickEditLink) {
                            // The first span in quick edit link contains the actual HTML, use it.
                            value = (quickEditLink.querySelector('span')?.innerHTML ?? '').trim();
                        }
                    }
                }

                details.push({
                    label: columnData.label,
                    value: String(value),
                    allowHTML: !!columnData.allowHTML,
                });
            });

            return {
                type: playbackAnchor?.innerText ??
                    Translate.instant('addon.mod_bigbluebuttonbn.view_recording_format_presentation'),
                name: CoreTextUtils.cleanTags(String(recordingData.recording), true),
                url: playbackAnchor?.href ?? '',
                details,
                expanded: false,
            };
        });
    }

    /**
     * @inheritdoc
     */
    protected async logActivity(): Promise<void> {
        if (!this.bbb) {
            return; // Shouldn't happen.
        }

        await AddonModBBB.logView(this.bbb.id, this.bbb.name);
    }

    /**
     * Update meeting info.
     *
     * @param updateCache Whether to update info cached data (in server).
     * @return Promise resolved when done.
     */
    async updateMeetingInfo(updateCache?: boolean): Promise<void> {
        if (!this.bbb) {
            return;
        }

        this.showLoading = true;

        try {
            await AddonModBBB.invalidateAllGroupsMeetingInfo(this.bbb.id);

            await this.fetchMeetingInfo(updateCache);
        } finally {
            this.showLoading = false;
        }
    }

    /**
     * @inheritdoc
     */
    protected async invalidateContent(): Promise<void> {
        const promises: Promise<void>[] = [];

        promises.push(AddonModBBB.invalidateBBBs(this.courseId));
        promises.push(CoreGroups.invalidateActivityGroupInfo(this.module.id));

        if (this.bbb) {
            promises.push(AddonModBBB.invalidateAllGroupsMeetingInfo(this.bbb.id));
            promises.push(AddonModBBB.invalidateAllGroupsRecordings(this.bbb.id));
        }

        await Promise.all(promises);
    }

    /**
     * Group changed, reload some data.
     *
     * @return Promise resolved when done.
     */
    async groupChanged(): Promise<void> {
        this.showLoading = true;

        try {
            await this.fetchMeetingInfo();

            await this.fetchRecordings();
        } catch (error) {
            CoreDomUtils.showErrorModal(error);
        } finally {
            this.showLoading = false;
        }
    }

    /**
     * Join the room.
     *
     * @return Promise resolved when done.
     */
    async joinRoom(): Promise<void> {
        const modal = await CoreDomUtils.showModalLoading();

        try {
            const joinUrl = await AddonModBBB.getJoinUrl(this.module.id, this.groupId);

            await CoreUtils.openInBrowser(joinUrl, {
                showBrowserWarning: false,
            });

            // Leave some time for the room to load.
            await CoreApp.waitForResume(10000);

            this.updateMeetingInfo(true);
        } catch (error) {
            CoreDomUtils.showErrorModal(error);
        } finally {
            modal.dismiss();
        }
    }

    /**
     * End the meeting.
     *
     * @return Promise resolved when done.
     */
    async endMeeting(): Promise<void> {
        if (!this.bbb) {
            return;
        }

        try {
            await CoreDomUtils.showConfirm(
                Translate.instant('addon.mod_bigbluebuttonbn.end_session_confirm'),
                Translate.instant('addon.mod_bigbluebuttonbn.end_session_confirm_title'),
                Translate.instant('core.yes'),
            );
        } catch {
            // User canceled.
            return;
        }

        const modal = await CoreDomUtils.showModalLoading();

        try {
            await AddonModBBB.endMeeting(this.bbb.id, this.groupId);

            this.updateMeetingInfo();
        } catch (error) {
            CoreDomUtils.showErrorModal(error);
        } finally {
            modal.dismiss();
        }
    }

    /**
     * Toogle the visibility of a recording (expand/collapse).
     *
     * @param recording Recording.
     */
    toggle(recording: RecordingData): void {
        recording.expanded = !recording.expanded;
    }

    /**
     * Play a recording.
     *
     * @param event Click event.
     * @param recording Recording.
     */
    playRecording(event: MouseEvent, recording: RecordingData): void {
        event.preventDefault();
        event.stopPropagation();

        CoreSites.getCurrentSite()?.openInBrowserWithAutoLogin(recording.url);
    }

}

/**
 * Recording data.
 */
type RecordingData = {
    type: string;
    name: string;
    url: string;
    expanded: boolean;
    details: RecordingDetailData[];
};

/**
 * Recording detail data.
 */
type RecordingDetailData = {
    label: string;
    value: string;
    allowHTML: boolean;
};
