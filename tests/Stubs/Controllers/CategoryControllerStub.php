<?php

namespace Tests\Stubs\Controllers;

use App\Http\Controllers\Api\BasicCrudController;
use Tests\Stubs\Models\CategoryStub;

class CategoryControllerStub extends BasicCrudController
{
   protected function model()
   {
       return CategoryStub::class;
   }

   protected function rulesStore(): array
   {
       return [
            'name' => 'required|max:255',
            'description' => 'nullable|max:255'
       ];
   }

   protected function rulesUpdate(): array
   {
       return [
           'name' => 'required|max:255'
       ];
   }
}