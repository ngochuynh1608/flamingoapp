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

import { Injectable, Type } from '@angular/core';

import { AuthEmailSignupProfileField } from '@features/login/services/login-helper';
import { CoreUserProfileField } from '@features/user/services/user';
import { CoreUserProfileFieldHandler, CoreUserProfileFieldHandlerData } from '@features/user/services/user-profile-field-delegate';
import { CoreFormFields } from '@singletons/form';
import { makeSingleton } from '@singletons';
import { AddonUserProfileFieldDatetimeComponent } from '../../component/datetime';
import moment from 'moment-timezone';

/**
 * Datetime user profile field handlers.
 */
@Injectable({ providedIn: 'root' })
export class AddonUserProfileFieldDatetimeHandlerService implements CoreUserProfileFieldHandler {

    name = 'AddonUserProfileFieldDatetime';
    type = 'datetime';

    /**
     * Whether or not the handler is enabled on a site level.
     *
     * @return Promise resolved with true if enabled.
     */
    async isEnabled(): Promise<boolean> {
        return true;
    }

    /**
     * Get the data to send for the field based on the input data.
     *
     * @param field User field to get the data for.
     * @param signup True if user is in signup page.
     * @param registerAuth Register auth method. E.g. 'email'.
     * @param formValues Form Values.
     * @return Data to send for the field.
     */
    async getData(
        field: AuthEmailSignupProfileField | CoreUserProfileField,
        signup: boolean,
        registerAuth: string,
        formValues: CoreFormFields,
    ): Promise<CoreUserProfileFieldHandlerData | undefined> {
        const name = 'profile_field_' + field.shortname;

        if (formValues[name]) {
            return {
                type: 'datetime',
                name: 'profile_field_' + field.shortname,
                value: moment(<string> formValues[name]).unix(),
            };
        }
    }

    /**
     * Return the Component to use to display the user profile field.
     * It's recommended to return the class of the component, but you can also return an instance of the component.
     *
     * @return The component (or promise resolved with component) to use, undefined if not found.
     */
    getComponent(): Type<unknown> | Promise<Type<unknown>> {
        return AddonUserProfileFieldDatetimeComponent;
    }

}

export const AddonUserProfileFieldDatetimeHandler = makeSingleton(AddonUserProfileFieldDatetimeHandlerService);
