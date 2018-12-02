import { Exercise } from "./exercise.model";
import { Subject } from 'rxjs/Subject';
import { Injectable } from "@angular/core";
import { AngularFirestore } from "@angular/fire/firestore";
import { Store } from '@ngrx/store';
import { take } from 'rxjs/operators';

import { map } from "rxjs/operators";
import { Subscription, from } from "rxjs";
import { UIService } from "../shared/ui.service";
import * as UI from '../shared/ui.actions';
import * as Training from './training.actions';
import * as fromTraining from './training.reducer';


@Injectable()
export class TrainingService {
    private fbSubs: Subscription[] = [];

    constructor(private db: AngularFirestore,
                private uiService: UIService,
                private store: Store<fromTraining.State>) {}

    getAvailableExercises() {
        this.store.dispatch(new UI.StartLoading());
        this.fbSubs.push(this.db
            .collection('availableExercises')
            .snapshotChanges()
            .pipe(map(docArray => {
                const mappedArray = 
                    docArray.map(doc => {
                        return {
                            id: doc.payload.doc.id,
                            name: doc.payload.doc.data()['name'],
                            duration: doc.payload.doc.data()['duration'],
                            calories: doc.payload.doc.data()['calories']
                        };
                })
                return mappedArray;
            }))
            .subscribe((exercises: Exercise[]) => {
                this.store.dispatch(new UI.StopLoading());
                this.store.dispatch(new Training.SetAvailableTrainings(exercises));
            }, error => {
                this.uiService.showSnackbar('Fetching exercise failed, please try again later', null, 3000);
                this.store.dispatch(new UI.StopLoading());
            }));
    }

    startExercise(selectedId: string) {
        this.store.dispatch(new Training.StartTraining(selectedId));
        // this.runningExercise = this.availableExercies.find(ex => ex.id === selectedId);
        // this.exerciseChanged.next({...this.runningExercise});
    }

    completeExercise() {
        this.store.select(fromTraining.getActiveTraining)
            .pipe(take(1))
            .subscribe(ex => {
                this.addDataToDatabase({
                    ...ex,
                    date: new Date(),
                    state: 'completed'});
                this.store.dispatch(new Training.StopTraining());
            });
    }

    cancelExercise(progress: number) {
        this.store.select(fromTraining.getActiveTraining)
            .pipe(take(1))
            .subscribe(ex => {
                this.addDataToDatabase({
                    ...ex,
                    duration: ex.duration * (progress / 100),
                    calories: ex.calories * (progress / 100), 
                    date: new Date(),
                    state: 'cancelled'});
                this.store.dispatch(new Training.StopTraining());
            });
    }

    // getExercise(selectedId: string) {
    //     return this.availableExercies.find(ex => ex.id === selectedId);
    // }

    getPastExercies() {
        this.fbSubs.push(this.db
            .collection('finishedExercises')
            .valueChanges()
            .subscribe((exercises: Exercise[]) => {
                this.store.dispatch(new Training.SetFinishedTrainings(exercises));
            }, error => {
                console.log(error);
            }));
    }

    cancelSubscriptions() {
        this.fbSubs.forEach(sub => sub.unsubscribe());
    }

    private addDataToDatabase(exercise: Exercise) {
        this.db.collection('finishedExercises').add(exercise);
    }
}

